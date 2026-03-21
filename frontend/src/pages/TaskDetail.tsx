import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, MessageSquare, Send, Star } from "lucide-react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { queryKeys } from "@/api/query-keys";
import { analyticsService } from "@/api/services/analytics";
import { chatsService } from "@/api/services/chats";
import { offersService } from "@/api/services/offers";
import { tasksService } from "@/api/services/tasks";
import { CreateRequestModal } from "@/components/CreateRequestModal";
import { TopNav } from "@/components/TopNav";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import {
  PAYMENT_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
} from "@/lib/data";
import { mapTaskDtoToUi } from "@/lib/task-mappers";
import type { ApiPaymentType } from "@/api/types";

type ActionModal = "service" | "price" | "message" | "counter" | "edit-offer" | "cancel-task" | "dispute-task" | null;

const OFFER_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  accepted: "Принят",
  rejected: "Отклонён",
  withdrawn: "Отозван",
};

function getOfferStatusClass(status: string) {
  if (status === "accepted") return "status-done";
  if (status === "rejected" || status === "withdrawn") return "status-cancelled";
  return "status-offers";
}

const TaskDetail = () => {
  const queryClient = useQueryClient();
  const { id } = useParams();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [selectedOfferForCounter, setSelectedOfferForCounter] = useState<number | null>(null);

  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceEta, setServiceEta] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [priceComment, setPriceComment] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [counterPaymentType, setCounterPaymentType] = useState<ApiPaymentType>("fixed_price");
  const [counterPriceValue, setCounterPriceValue] = useState("");
  const [counterBarterDescription, setCounterBarterDescription] = useState("");
  const [editingOfferId, setEditingOfferId] = useState<number | null>(null);
  const [editOfferMessage, setEditOfferMessage] = useState("");
  const [editOfferPaymentType, setEditOfferPaymentType] = useState<ApiPaymentType>("negotiable");
  const [editOfferPriceValue, setEditOfferPriceValue] = useState("");
  const [editOfferBarterDescription, setEditOfferBarterDescription] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [disputeComment, setDisputeComment] = useState("");

  const [serviceError, setServiceError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [counterError, setCounterError] = useState<string | null>(null);
  const [editOfferError, setEditOfferError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const numericTaskId = Number(id);
  const hasValidTaskId = Number.isFinite(numericTaskId);

  const taskQuery = useQuery({
    queryKey: queryKeys.task(numericTaskId),
    queryFn: () => tasksService.getById(numericTaskId),
    enabled: hasValidTaskId,
  });

  const offersQuery = useQuery({
    queryKey: queryKeys.offers(numericTaskId),
    queryFn: () => offersService.listByTask(numericTaskId),
    enabled: taskQuery.isSuccess,
  });

  const chatsQuery = useQuery({
    queryKey: queryKeys.chats,
    queryFn: chatsService.list,
    enabled: taskQuery.isSuccess,
  });

  const counterOffersQuery = useQuery({
    queryKey: queryKeys.counterOffers(selectedOfferForCounter ?? 0),
    queryFn: () => offersService.listCounterOffers(selectedOfferForCounter as number),
    enabled: actionModal === "counter" && Boolean(selectedOfferForCounter),
  });

  const analyticsCategory = taskQuery.data?.category ?? null;
  const analyticsQuery = useQuery({
    queryKey: queryKeys.analyticsCategory(analyticsCategory ?? ""),
    queryFn: () => analyticsService.getCategory(analyticsCategory as string),
    enabled: taskQuery.isSuccess && Boolean(analyticsCategory) && !taskQuery.data?.analytics,
  });

  const task = taskQuery.data ? mapTaskDtoToUi(taskQuery.data) : null;
  const categoryAnalytics = taskQuery.data?.analytics ?? analyticsQuery.data ?? null;
  const analyticsHistogram = categoryAnalytics?.price_histogram ?? [];
  const analyticsMaxCount = Math.max(...analyticsHistogram.map((entry) => entry.count), 0);
  const isAnalyticsLoading = Boolean(analyticsCategory) && !taskQuery.data?.analytics && analyticsQuery.isLoading;
  const hasAnalyticsError = !categoryAnalytics && analyticsQuery.isError;

  const chatIdFromTask = typeof taskQuery.data?.chat_id === "number" ? taskQuery.data.chat_id : null;
  const chatIdFromList = chatsQuery.data?.find((chat) => chat.task_id === numericTaskId)?.id ?? null;
  const chatId = chatIdFromTask ?? chatIdFromList;

  const messagesQuery = useQuery({
    queryKey: queryKeys.chatMessages(chatId ?? 0),
    queryFn: () => chatsService.listMessages(chatId as number, { limit: 50 }),
    enabled: actionModal === "message" && Boolean(chatId),
    refetchInterval: actionModal === "message" ? 5000 : false,
  });

  useEffect(() => {
    if (actionModal === "message" && chatId) {
      void chatsService.markRead(chatId).catch(() => undefined);
    }
  }, [actionModal, chatId]);

  const createOfferMutation = useMutation({
    mutationFn: (payload: { message: string; payment_type: "fixed_price" | "negotiable"; price_amount: number | null }) => (
      offersService.createForTask(numericTaskId, {
        message: payload.message,
        payment_type: payload.payment_type,
        price_amount: payload.price_amount,
        barter_description: null,
      })
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
  });

  const updateOfferMutation = useMutation({
    mutationFn: (payload: {
      offerId: number;
      message: string;
      payment_type: ApiPaymentType;
      price_amount: number | null;
      barter_description: string | null;
    }) => offersService.update(payload.offerId, {
      message: payload.message,
      payment_type: payload.payment_type,
      price_amount: payload.price_amount,
      barter_description: payload.barter_description,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
      ]);
      toast({
        title: "Отклик обновлён",
        description: "Новые условия отправлены заказчику.",
      });
      setEditingOfferId(null);
      setEditOfferError(null);
      setActionModal(null);
    },
    onError: (error) => {
      setEditOfferError(error instanceof Error ? error.message : "Не удалось обновить отклик");
    },
  });

  const withdrawOfferMutation = useMutation({
    mutationFn: offersService.withdraw,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
      ]);
      toast({
        title: "Отклик отозван",
        description: "Ваш отклик больше не участвует в выборе исполнителя.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось отозвать отклик",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (payload: { chatId: number; body: string }) => chatsService.sendMessage(payload.chatId, payload.body),
    onSuccess: async () => {
      if (chatId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(chatId) });
      }
    },
  });

  const acceptOfferMutation = useMutation({
    mutationFn: offersService.accept,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chats }),
      ]);
      toast({
        title: "Исполнитель выбран",
        description: "Задача переведена в работу.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось выбрать исполнителя",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const rejectOfferMutation = useMutation({
    mutationFn: offersService.reject,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
      ]);
      toast({
        title: "Отклик отклонён",
        description: "Предложение больше не активно.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось отклонить отклик",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const createCounterOfferMutation = useMutation({
    mutationFn: (payload: {
      offerId: number;
      message: string | null;
      payment_type: ApiPaymentType;
      price_amount: number | null;
      barter_description: string | null;
    }) => offersService.createCounterOffer(payload.offerId, {
      message: payload.message,
      payment_type: payload.payment_type,
      price_amount: payload.price_amount,
      barter_description: payload.barter_description,
    }),
    onSuccess: async () => {
      if (!selectedOfferForCounter) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.counterOffers(selectedOfferForCounter) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
      ]);
      toast({
        title: "Контрпредложение отправлено",
        description: "Условия обновлены в переговорах по отклику.",
      });
    },
    onError: (error) => {
      setCounterError(error instanceof Error ? error.message : "Не удалось отправить контрпредложение");
    },
  });

  const acceptCounterOfferMutation = useMutation({
    mutationFn: offersService.acceptCounterOffer,
    onSuccess: async () => {
      if (selectedOfferForCounter) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.counterOffers(selectedOfferForCounter) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) });
      toast({
        title: "Контрпредложение принято",
        description: "Финальные условия отклика обновлены.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось принять контрпредложение",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const rejectCounterOfferMutation = useMutation({
    mutationFn: offersService.rejectCounterOffer,
    onSuccess: async () => {
      if (selectedOfferForCounter) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.counterOffers(selectedOfferForCounter) });
      }
      toast({
        title: "Контрпредложение отклонено",
        description: "Раунд переговоров завершён.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось отклонить контрпредложение",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const cancelTaskMutation = useMutation({
    mutationFn: (reason: string) => tasksService.cancel(numericTaskId, reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      toast({
        title: "Задача отменена",
        description: "Статус заявки обновлён.",
      });
      setCancelReason("");
      setCancelError(null);
      setActionModal(null);
    },
    onError: (error) => {
      setCancelError(error instanceof Error ? error.message : "Не удалось отменить задачу");
    },
  });

  const completeRequestMutation = useMutation({
    mutationFn: () => tasksService.completeRequest(numericTaskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) });
      toast({
        title: "Запрос на завершение отправлен",
        description: "Ожидаем подтверждение второй стороны.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось отправить запрос",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const confirmCompletionMutation = useMutation({
    mutationFn: () => tasksService.confirmCompletion(numericTaskId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      toast({
        title: "Задача подтверждена как выполненная",
        description: "Статус задачи обновлён на завершённую.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось подтвердить выполнение",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const openDisputeMutation = useMutation({
    mutationFn: (comment: string) => tasksService.openDispute(numericTaskId, comment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) });
      toast({
        title: "Спор открыт",
        description: "Заявка отправлена в модерацию.",
      });
      setDisputeComment("");
      setDisputeError(null);
      setActionModal(null);
    },
    onError: (error) => {
      setDisputeError(error instanceof Error ? error.message : "Не удалось открыть спор");
    },
  });

  const closeActionModal = () => {
    setActionModal(null);
    setServiceError(null);
    setPriceError(null);
    setMessageError(null);
    setCounterError(null);
    setEditOfferError(null);
    setCancelError(null);
    setDisputeError(null);
  };

  const handleServiceSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedTitle = serviceTitle.trim();

    if (!normalizedTitle) {
      setServiceError("Укажите, какую услугу вы предлагаете.");
      return;
    }

    const payload = [normalizedTitle, serviceDescription.trim(), serviceEta ? `Срок: ${serviceEta}` : ""]
      .filter(Boolean)
      .join(" · ");

    try {
      await createOfferMutation.mutateAsync({
        message: payload,
        payment_type: "negotiable",
        price_amount: null,
      });

      toast({
        title: "Предложение отправлено",
        description: "Отклик добавлен к задаче.",
      });

      setServiceTitle("");
      setServiceDescription("");
      setServiceEta("");
      closeActionModal();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Не удалось отправить предложение");
    }
  };

  const handlePriceSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedPrice = Number(priceValue);

    if (!priceValue || Number.isNaN(normalizedPrice) || normalizedPrice <= 0) {
      setPriceError("Введите корректную сумму предложения.");
      return;
    }

    const payload = [priceComment.trim(), `${normalizedPrice} ₽`].filter(Boolean).join(" · ");

    try {
      await createOfferMutation.mutateAsync({
        message: payload,
        payment_type: "fixed_price",
        price_amount: normalizedPrice,
      });

      toast({
        title: "Цена отправлена",
        description: "Ценовой отклик добавлен к задаче.",
      });

      setPriceValue("");
      setPriceComment("");
      closeActionModal();
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : "Не удалось отправить цену");
    }
  };

  const handleMessageSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!chatId) {
      setMessageError("Чат ещё не создан. Он появится после выбора исполнителя.");
      return;
    }

    const normalizedMessage = messageValue.trim();

    if (!normalizedMessage) {
      setMessageError("Сообщение не может быть пустым.");
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({ chatId, body: normalizedMessage });

      toast({
        title: "Сообщение отправлено",
        description: "Сообщение появилось в чате задачи.",
      });

      setMessageValue("");
      setMessageError(null);
      await messagesQuery.refetch();
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Не удалось отправить сообщение");
    }
  };

  const handleCounterOfferSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedOfferForCounter) {
      setCounterError("Сначала выберите отклик для контрпредложения.");
      return;
    }

    const normalizedCounterMessage = counterMessage.trim();
    const normalizedCounterBarter = counterBarterDescription.trim();
    const normalizedCounterPrice = Number(counterPriceValue);

    if (counterPaymentType === "fixed_price" && (!counterPriceValue || Number.isNaN(normalizedCounterPrice) || normalizedCounterPrice <= 0)) {
      setCounterError("Для фиксированной цены укажите корректную сумму.");
      return;
    }

    if (counterPaymentType === "barter" && !normalizedCounterBarter) {
      setCounterError("Для barter опишите обмен.");
      return;
    }

    setCounterError(null);

    await createCounterOfferMutation.mutateAsync({
      offerId: selectedOfferForCounter,
      message: normalizedCounterMessage || null,
      payment_type: counterPaymentType,
      price_amount: counterPaymentType === "fixed_price" ? normalizedCounterPrice : null,
      barter_description: counterPaymentType === "barter" ? normalizedCounterBarter : null,
    });
  };

  const handleEditOfferSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingOfferId) {
      setEditOfferError("Отклик не выбран.");
      return;
    }

    const normalizedMessage = editOfferMessage.trim();
    const normalizedPrice = Number(editOfferPriceValue);
    const normalizedBarter = editOfferBarterDescription.trim();

    if (!normalizedMessage) {
      setEditOfferError("Сообщение отклика не может быть пустым.");
      return;
    }

    if (editOfferPaymentType === "fixed_price" && (!editOfferPriceValue || Number.isNaN(normalizedPrice) || normalizedPrice <= 0)) {
      setEditOfferError("Для фиксированной цены укажите корректную сумму.");
      return;
    }

    if (editOfferPaymentType === "barter" && !normalizedBarter) {
      setEditOfferError("Для barter добавьте описание обмена.");
      return;
    }

    setEditOfferError(null);

    await updateOfferMutation.mutateAsync({
      offerId: editingOfferId,
      message: normalizedMessage,
      payment_type: editOfferPaymentType,
      price_amount: editOfferPaymentType === "fixed_price" ? normalizedPrice : null,
      barter_description: editOfferPaymentType === "barter" ? normalizedBarter : null,
    });
  };

  const handleCancelTaskSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedReason = cancelReason.trim();
    if (!normalizedReason) {
      setCancelError("Укажите причину отмены.");
      return;
    }

    setCancelError(null);
    await cancelTaskMutation.mutateAsync(normalizedReason);
  };

  const handleDisputeSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedComment = disputeComment.trim();
    if (!normalizedComment) {
      setDisputeError("Опишите причину спора.");
      return;
    }

    setDisputeError(null);
    await openDisputeMutation.mutateAsync(normalizedComment);
  };

  const urgencyClass = !task ? "chip-inactive" :
    task.urgency === "urgent" ? "urgency-urgent" :
      task.urgency === "today" ? "urgency-today" :
        task.urgency === "week" ? "urgency-week" : "chip-inactive";

  const statusClass = !task ? "status-open" :
    task.status === "open" ? "status-open" :
      task.status === "offers" ? "status-offers" :
        task.status === "progress" ? "status-progress" :
          task.status === "done" ? "status-done" : "status-cancelled";

  const canRespond = taskQuery.data?.can_respond ?? (task?.status === "open" || task?.status === "offers");
  const isTaskOwner = taskQuery.data?.customer?.id === user?.id;
  const canChoosePerformer = taskQuery.data?.can_choose_performer ?? (isTaskOwner && task?.status === "offers");
  const canManageProgress = Boolean(isTaskOwner && task?.status === "progress");

  if (!hasValidTaskId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="card-surface p-6 max-w-md w-full">
          <h2 className="text-base font-semibold text-foreground">Некорректный идентификатор задачи</h2>
          <Link to="/" className="inline-block mt-3 text-sm text-primary hover:text-primary/80">Вернуться к ленте</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-4 h-4" />
          Назад к бирже
        </Link>

        {taskQuery.isLoading && (
          <div className="space-y-4">
            <div className="card-surface h-72 animate-pulse" />
            <div className="card-surface h-64 animate-pulse" />
          </div>
        )}

        {taskQuery.isError && (
          <div className="card-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">Не удалось загрузить задачу</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {taskQuery.error instanceof Error ? taskQuery.error.message : "Попробуйте обновить страницу."}
            </p>
            <button
              type="button"
              onClick={() => void taskQuery.refetch()}
              className="mt-3 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Повторить
            </button>
          </div>
        )}

        {!taskQuery.isLoading && !taskQuery.isError && task && (
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 space-y-5">
              <div className="card-surface p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{task.categoryIcon}</span>
                  <span className="text-sm text-muted-foreground">{task.dorm}</span>
                  <span className={`chip text-xs px-2 py-0.5 ${statusClass}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span className={`chip text-xs px-2 py-0.5 ${urgencyClass}`}>
                    {URGENCY_LABELS[task.urgency]}
                  </span>
                </div>

                <h1 className="text-xl font-semibold text-foreground mb-3">{task.title}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{task.description}</p>

                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary">
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-0.5">Оплата</div>
                    <div className="text-sm font-medium text-foreground">{PAYMENT_LABELS[task.paymentType]}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-0.5">Цена</div>
                    <div className="text-sm font-semibold text-foreground">{task.price ? `${task.price} ₽` : "По договорённости"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-0.5">Предложения</div>
                    <div className="text-sm font-medium text-foreground">{task.offersCount}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {task.requesterAvatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{task.requesterName}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-warning fill-warning" />
                        <span className="text-xs font-medium text-foreground">{task.requesterRating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Пользователь платформы</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-surface p-6">
                <h3 className="font-semibold text-sm text-foreground mb-4">Аналитика категории: {task.categoryIcon} История сделок</h3>

                {isAnalyticsLoading ? (
                  <div className="space-y-4">
                    <div className="h-48 rounded-lg bg-secondary animate-pulse" />
                    <div className="grid grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-20 rounded-lg bg-secondary animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : hasAnalyticsError ? (
                  <div className="p-4 rounded-lg border border-border bg-secondary/40">
                    <div className="text-sm text-foreground">Не удалось загрузить аналитику категории.</div>
                    <button
                      type="button"
                      onClick={() => void analyticsQuery.refetch()}
                      className="mt-2 text-xs text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                ) : categoryAnalytics ? (
                  <>
                    {analyticsHistogram.length > 0 ? (
                      <div className="h-48 mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsHistogram}>
                            <XAxis dataKey="range" tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                background: "hsl(0, 0%, 100%)",
                                border: "1px solid hsl(220, 13%, 91%)",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                              formatter={(value: number) => [`${value} сделок`, "Количество"]}
                            />
                            <ReferenceLine
                              y={Math.round(analyticsMaxCount / 2)}
                              stroke="hsl(217, 91%, 60%)"
                              strokeDasharray="4 4"
                              label={{ value: "Ориентир", position: "right", fontSize: 11, fill: "hsl(217, 91%, 60%)" }}
                            />
                            <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 mb-4 rounded-lg border border-border bg-secondary/40 flex items-center justify-center text-sm text-muted-foreground">
                        По этой категории пока нет гистограммы завершённых сделок.
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Медианная цена", value: `${categoryAnalytics.median_price_amount} ₽` },
                        { label: "Средняя цена", value: `${categoryAnalytics.avg_price_amount} ₽` },
                        { label: "Диапазон", value: `${categoryAnalytics.min_price_amount}–${categoryAnalytics.max_price_amount} ₽` },
                        { label: "Среднее время", value: `${Math.round(categoryAnalytics.avg_completion_minutes / 60 * 10) / 10} часа` },
                      ].map((s) => (
                        <div key={s.label} className="p-3 rounded-lg bg-secondary">
                          <div className="text-base font-semibold text-foreground">{s.value}</div>
                          <div className="text-[11px] text-muted-foreground">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 pt-5 border-t border-border">
                      <h4 className="text-sm font-medium text-foreground mb-3">Последние сделки</h4>
                      <div className="p-3 rounded-lg border border-border bg-secondary/50 text-sm text-muted-foreground">
                        API пока возвращает только агрегированную аналитику по категории. Список отдельных последних сделок для этой карточки ещё недоступен.
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 rounded-lg border border-border bg-secondary/40 text-sm text-muted-foreground">
                    Для этой категории аналитика пока не рассчитана.
                  </div>
                )}
              </div>
            </div>

            <div className="w-80 shrink-0 space-y-4">
              <div className="card-surface p-5 space-y-3 sticky top-20">
                <button
                  onClick={() => setActionModal("service")}
                  disabled={!canRespond}
                  className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Предложить услугу
                </button>
                <button
                  onClick={() => setActionModal("price")}
                  disabled={!canRespond}
                  className="w-full h-11 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Предложить цену
                </button>
                <button
                  onClick={() => {
                    if (!chatId) {
                      toast({
                        title: "Чат недоступен",
                        description: "Чат появляется после выбора исполнителя.",
                      });
                      return;
                    }
                    setActionModal("message");
                  }}
                  disabled={!chatId}
                  className="w-full h-11 rounded-lg border border-border text-muted-foreground font-medium text-sm hover:bg-accent transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                  Написать
                </button>

                {isTaskOwner && task.status !== "cancelled" && task.status !== "done" && (
                  <button
                    onClick={() => setActionModal("cancel-task")}
                    className="w-full h-11 rounded-lg border border-destructive/40 text-destructive font-medium text-sm hover:bg-destructive/5 transition-colors"
                  >
                    Отменить задачу
                  </button>
                )}

                {canManageProgress && (
                  <>
                    <button
                      onClick={() => completeRequestMutation.mutate()}
                      className="w-full h-11 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
                      disabled={completeRequestMutation.isPending}
                    >
                      {completeRequestMutation.isPending ? "Отправляем..." : "Запросить завершение"}
                    </button>
                    <button
                      onClick={() => confirmCompletionMutation.mutate()}
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                      disabled={confirmCompletionMutation.isPending}
                    >
                      {confirmCompletionMutation.isPending ? "Подтверждаем..." : "Подтвердить выполнение"}
                    </button>
                    <button
                      onClick={() => setActionModal("dispute-task")}
                      className="w-full h-11 rounded-lg border border-border text-muted-foreground font-medium text-sm hover:bg-accent transition-colors"
                    >
                      Открыть спор
                    </button>
                  </>
                )}

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Создано {task.createdAt}
                  </div>
                </div>
              </div>

              <div className="card-surface p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Отклики по задаче</h4>

                {offersQuery.isLoading && (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-16 rounded-lg bg-secondary animate-pulse" />
                    ))}
                  </div>
                )}

                {!offersQuery.isLoading && offersQuery.isError && (
                  <div className="text-xs text-destructive">
                    Не удалось загрузить отклики.
                    <button
                      type="button"
                      onClick={() => void offersQuery.refetch()}
                      className="ml-2 text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {!offersQuery.isLoading && !offersQuery.isError && (offersQuery.data ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground">Пока нет откликов.</div>
                )}

                {!offersQuery.isLoading && !offersQuery.isError && (
                  <div className="space-y-2">
                    {(offersQuery.data ?? []).slice(0, 5).map((offer) => {
                      const isOwnPendingOffer = offer.performer?.id === user?.id && offer.status === "pending";
                      const canCounterOffer = offer.status === "pending" && (isTaskOwner || offer.performer?.id === user?.id);

                      return (
                        <div key={offer.id} className="p-2.5 rounded-lg bg-secondary">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-foreground">
                              {offer.performer?.full_name ?? "Исполнитель"}
                            </div>
                            <span className={`chip text-[10px] px-1.5 py-0.5 ${getOfferStatusClass(offer.status)}`}>
                              {OFFER_STATUS_LABELS[offer.status] ?? offer.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{offer.message}</div>
                          <div className="text-xs text-foreground mt-1">
                            {offer.payment_type === "fixed_price"
                              ? `${offer.price_amount ?? "—"} ₽`
                              : offer.payment_type === "barter"
                                ? "Бартер"
                                : "Договорная"}
                          </div>
                          {isOwnPendingOffer && (
                            <div className="mt-2 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOfferId(offer.id);
                                  setEditOfferMessage(offer.message ?? "");
                                  setEditOfferPaymentType(offer.payment_type);
                                  setEditOfferPriceValue(offer.price_amount ? String(offer.price_amount) : "");
                                  setEditOfferBarterDescription(offer.barter_description ?? "");
                                  setEditOfferError(null);
                                  setActionModal("edit-offer");
                                }}
                                className="text-[11px] text-primary hover:text-primary/80"
                              >
                                Редактировать
                              </button>
                              <button
                                type="button"
                                onClick={() => withdrawOfferMutation.mutate(offer.id)}
                                className="text-[11px] text-primary hover:text-primary/80"
                                disabled={withdrawOfferMutation.isPending}
                              >
                                Отозвать отклик
                              </button>
                            </div>
                          )}

                          {canCounterOffer && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOfferForCounter(offer.id);
                                setCounterMessage("");
                                setCounterPaymentType("fixed_price");
                                setCounterPriceValue(String(offer.price_amount ?? ""));
                                setCounterBarterDescription(offer.barter_description ?? "");
                                setCounterError(null);
                                setActionModal("counter");
                              }}
                              className="text-[11px] text-primary mt-2 ml-3 hover:text-primary/80"
                            >
                              Контрпредложение
                            </button>
                          )}

                          {canChoosePerformer && offer.status === "pending" && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => acceptOfferMutation.mutate(offer.id)}
                                className="text-[11px] text-primary hover:text-primary/80"
                                disabled={acceptOfferMutation.isPending}
                              >
                                Выбрать исполнителя
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectOfferMutation.mutate(offer.id)}
                                className="text-[11px] text-muted-foreground hover:text-foreground"
                                disabled={rejectOfferMutation.isPending}
                              >
                                Отклонить
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={actionModal === "service"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предложить услугу</DialogTitle>
            <DialogDescription>Опишите, как вы готовы выполнить задачу.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleServiceSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Название услуги</label>
              <input
                type="text"
                value={serviceTitle}
                onChange={(event) => {
                  setServiceTitle(event.target.value);
                  if (serviceError) setServiceError(null);
                }}
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Например: Перенесу мебель вдвоём"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий</label>
              <textarea
                rows={3}
                value={serviceDescription}
                onChange={(event) => setServiceDescription(event.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Коротко опишите опыт и условия"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Срок выполнения</label>
              <input
                type="text"
                value={serviceEta}
                onChange={(event) => setServiceEta(event.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Например: сегодня до 20:00"
              />
            </div>
            {serviceError && <p className="text-xs text-destructive">{serviceError}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              disabled={createOfferMutation.isPending}
            >
              {createOfferMutation.isPending ? "Отправляем..." : "Отправить предложение"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === "price"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предложить цену</DialogTitle>
            <DialogDescription>Укажите вашу стоимость и при необходимости добавьте комментарий.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePriceSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Сумма</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={priceValue}
                  onChange={(event) => {
                    setPriceValue(event.target.value);
                    if (priceError) setPriceError(null);
                  }}
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий</label>
              <textarea
                rows={3}
                value={priceComment}
                onChange={(event) => setPriceComment(event.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Например: могу начать через 30 минут"
              />
            </div>
            {priceError && <p className="text-xs text-destructive">{priceError}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              disabled={createOfferMutation.isPending}
            >
              {createOfferMutation.isPending ? "Отправляем..." : "Отправить цену"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === "counter"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Контрпредложение</DialogTitle>
            <DialogDescription>Согласуйте условия по выбранному отклику.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
              {counterOffersQuery.isLoading && (
                Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-lg bg-secondary animate-pulse" />
                ))
              )}

              {!counterOffersQuery.isLoading && !counterOffersQuery.isError && (counterOffersQuery.data ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground">История переговоров пока пуста.</div>
              )}

              {!counterOffersQuery.isLoading && counterOffersQuery.isError && (
                <div className="text-xs text-destructive">
                  Не удалось загрузить историю переговоров.
                  <button
                    type="button"
                    onClick={() => void counterOffersQuery.refetch()}
                    className="ml-2 text-primary hover:text-primary/80"
                  >
                    Повторить
                  </button>
                </div>
              )}

              {!counterOffersQuery.isLoading && !counterOffersQuery.isError && (counterOffersQuery.data ?? []).map((counter) => {
                const isOwn = counter.author_user_id === user?.id;
                const isPendingForAction = counter.status === "pending" && !isOwn;

                return (
                  <div key={counter.id} className="p-2 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{isOwn ? "Вы" : "Собеседник"}</span>
                      <span className={`chip text-[10px] px-1.5 py-0.5 ${counter.status === "accepted" ? "status-done" : counter.status === "rejected" ? "status-cancelled" : "status-offers"}`}>
                        {counter.status}
                      </span>
                    </div>
                    {counter.message && <div className="text-xs text-foreground mt-1">{counter.message}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {counter.payment_type === "fixed_price"
                        ? `${counter.price_amount ?? "—"} ₽`
                        : counter.payment_type === "barter"
                          ? `Бартер: ${counter.barter_description ?? "без описания"}`
                          : "Договорная"}
                    </div>
                    {isPendingForAction && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => acceptCounterOfferMutation.mutate(counter.id)}
                          className="text-[11px] text-primary hover:text-primary/80"
                          disabled={acceptCounterOfferMutation.isPending}
                        >
                          Принять
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectCounterOfferMutation.mutate(counter.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                          disabled={rejectCounterOfferMutation.isPending}
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form className="space-y-3" onSubmit={handleCounterOfferSubmit}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий</label>
                <textarea
                  rows={3}
                  value={counterMessage}
                  onChange={(event) => {
                    setCounterMessage(event.target.value);
                    if (counterError) setCounterError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Например: могу начать сегодня вечером"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Тип оплаты</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCounterPaymentType("fixed_price")}
                    className={`chip flex-1 justify-center text-xs ${counterPaymentType === "fixed_price" ? "chip-active" : "chip-inactive"}`}
                  >
                    Цена
                  </button>
                  <button
                    type="button"
                    onClick={() => setCounterPaymentType("negotiable")}
                    className={`chip flex-1 justify-center text-xs ${counterPaymentType === "negotiable" ? "chip-active" : "chip-inactive"}`}
                  >
                    Договорная
                  </button>
                  <button
                    type="button"
                    onClick={() => setCounterPaymentType("barter")}
                    className={`chip flex-1 justify-center text-xs ${counterPaymentType === "barter" ? "chip-active" : "chip-inactive"}`}
                  >
                    Бартер
                  </button>
                </div>
              </div>

              {counterPaymentType === "fixed_price" && (
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={counterPriceValue}
                    onChange={(event) => {
                      setCounterPriceValue(event.target.value);
                      if (counterError) setCounterError(null);
                    }}
                    className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                </div>
              )}

              {counterPaymentType === "barter" && (
                <textarea
                  rows={3}
                  value={counterBarterDescription}
                  onChange={(event) => {
                    setCounterBarterDescription(event.target.value);
                    if (counterError) setCounterError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Опишите обмен"
                />
              )}

              {counterError && <p className="text-xs text-destructive">{counterError}</p>}
              <button
                type="submit"
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                disabled={createCounterOfferMutation.isPending}
              >
                {createCounterOfferMutation.isPending ? "Отправляем..." : "Отправить контрпредложение"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === "edit-offer"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать отклик</DialogTitle>
            <DialogDescription>Обновите сообщение и условия вашего отклика.</DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleEditOfferSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Сообщение</label>
              <textarea
                rows={4}
                value={editOfferMessage}
                onChange={(event) => {
                  setEditOfferMessage(event.target.value);
                  if (editOfferError) setEditOfferError(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Опишите условия выполнения"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Тип оплаты</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditOfferPaymentType("fixed_price")}
                  className={`chip flex-1 justify-center text-xs ${editOfferPaymentType === "fixed_price" ? "chip-active" : "chip-inactive"}`}
                >
                  Цена
                </button>
                <button
                  type="button"
                  onClick={() => setEditOfferPaymentType("negotiable")}
                  className={`chip flex-1 justify-center text-xs ${editOfferPaymentType === "negotiable" ? "chip-active" : "chip-inactive"}`}
                >
                  Договорная
                </button>
                <button
                  type="button"
                  onClick={() => setEditOfferPaymentType("barter")}
                  className={`chip flex-1 justify-center text-xs ${editOfferPaymentType === "barter" ? "chip-active" : "chip-inactive"}`}
                >
                  Бартер
                </button>
              </div>
            </div>

            {editOfferPaymentType === "fixed_price" && (
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={editOfferPriceValue}
                  onChange={(event) => {
                    setEditOfferPriceValue(event.target.value);
                    if (editOfferError) setEditOfferError(null);
                  }}
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
              </div>
            )}

            {editOfferPaymentType === "barter" && (
              <textarea
                rows={3}
                value={editOfferBarterDescription}
                onChange={(event) => {
                  setEditOfferBarterDescription(event.target.value);
                  if (editOfferError) setEditOfferError(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Опишите barter-обмен"
              />
            )}

            {editOfferError && <p className="text-xs text-destructive">{editOfferError}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              disabled={updateOfferMutation.isPending}
            >
              {updateOfferMutation.isPending ? "Сохраняем..." : "Сохранить изменения"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === "message"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Чат по задаче</DialogTitle>
            <DialogDescription>Чат доступен после выбора исполнителя.</DialogDescription>
          </DialogHeader>

          {chatId ? (
            <div className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                {messagesQuery.isLoading && (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-12 rounded-lg bg-secondary animate-pulse" />
                  ))
                )}

                {!messagesQuery.isLoading && !messagesQuery.isError && (messagesQuery.data ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Сообщений пока нет.</p>
                )}

                {!messagesQuery.isLoading && !messagesQuery.isError && (messagesQuery.data ?? []).map((message) => {
                  const isOwn = message.sender_id === user?.id;

                  return (
                    <div
                      key={message.id}
                      className={`p-2.5 rounded-lg text-xs ${
                        isOwn ? "bg-primary text-primary-foreground ml-6" : "bg-card border border-border mr-6"
                      }`}
                    >
                      <div>{message.body}</div>
                    </div>
                  );
                })}

                {messagesQuery.isError && (
                  <div className="text-xs text-destructive">
                    Не удалось загрузить сообщения.
                    <button
                      type="button"
                      onClick={() => void messagesQuery.refetch()}
                      className="ml-2 text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                )}
              </div>

              <form className="space-y-3" onSubmit={handleMessageSubmit}>
                <textarea
                  rows={4}
                  value={messageValue}
                  onChange={(event) => {
                    setMessageValue(event.target.value);
                    if (messageError) setMessageError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Напишите сообщение..."
                />
                {messageError && <p className="text-xs text-destructive">{messageError}</p>}
                <button
                  type="submit"
                  className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  disabled={sendMessageMutation.isPending}
                >
                  {sendMessageMutation.isPending ? "Отправляем..." : "Отправить сообщение"}
                </button>
              </form>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Чат ещё не создан. Он будет доступен после назначения исполнителя по задаче.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === "cancel-task"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить задачу</DialogTitle>
            <DialogDescription>Укажите причину отмены, она будет сохранена в истории.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleCancelTaskSubmit}>
            <textarea
              rows={4}
              value={cancelReason}
              onChange={(event) => {
                setCancelReason(event.target.value);
                if (cancelError) setCancelError(null);
              }}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Например: уже не актуально"
            />
            {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              disabled={cancelTaskMutation.isPending}
            >
              {cancelTaskMutation.isPending ? "Отменяем..." : "Подтвердить отмену"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === "dispute-task"} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Открыть спор</DialogTitle>
            <DialogDescription>Опишите проблему по выполнению задачи.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleDisputeSubmit}>
            <textarea
              rows={4}
              value={disputeComment}
              onChange={(event) => {
                setDisputeComment(event.target.value);
                if (disputeError) setDisputeError(null);
              }}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Например: часть работы не выполнена"
            />
            {disputeError && <p className="text-xs text-destructive">{disputeError}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              disabled={openDisputeMutation.isPending}
            >
              {openDisputeMutation.isPending ? "Отправляем..." : "Открыть спор"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default TaskDetail;
