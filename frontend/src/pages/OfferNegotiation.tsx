import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MessageSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { queryKeys } from "@/api/query-keys";
import { offersService } from "@/api/services/offers";
import { tasksService } from "@/api/services/tasks";
import type { ApiPaymentType } from "@/api/types";
import { CreateRequestModal } from "@/components/CreateRequestModal";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/data";

const COUNTER_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает ответа",
  accepted: "Принято",
  rejected: "Отклонено",
  superseded: "Заменено новым раундом",
};

function getCounterStatusClass(status: string): string {
  if (status === "accepted") {
    return "status-done";
  }

  if (status === "rejected") {
    return "status-cancelled";
  }

  return "status-offers";
}

export default function OfferNegotiation() {
  const queryClient = useQueryClient();
  const { id, offerId } = useParams();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  const [counterPaymentType, setCounterPaymentType] = useState<ApiPaymentType>("fixed_price");
  const [counterPriceValue, setCounterPriceValue] = useState("");
  const [counterBarterDescription, setCounterBarterDescription] = useState("");
  const [counterError, setCounterError] = useState<string | null>(null);

  const numericTaskId = Number(id);
  const numericOfferId = Number(offerId);
  const hasValidParams = Number.isFinite(numericTaskId) && Number.isFinite(numericOfferId);

  const taskQuery = useQuery({
    queryKey: queryKeys.task(numericTaskId),
    queryFn: () => tasksService.getById(numericTaskId),
    enabled: hasValidParams,
  });

  const offersQuery = useQuery({
    queryKey: queryKeys.offers(numericTaskId),
    queryFn: () => offersService.listByTask(numericTaskId),
    enabled: hasValidParams,
  });

  const counterOffersQuery = useQuery({
    queryKey: queryKeys.counterOffers(numericOfferId),
    queryFn: () => offersService.listCounterOffers(numericOfferId),
    enabled: hasValidParams,
  });

  const offer = useMemo(
    () => offersQuery.data?.find((item) => item.id === numericOfferId) ?? null,
    [numericOfferId, offersQuery.data],
  );

  useEffect(() => {
    if (!offer) {
      return;
    }

    setCounterMessage("");
    setCounterPaymentType(offer.payment_type);
    setCounterPriceValue(offer.price_amount ? String(offer.price_amount) : "");
    setCounterBarterDescription(offer.barter_description ?? "");
    setCounterError(null);
  }, [offer]);

  const isTaskOwner = taskQuery.data?.customer?.id === user?.id;
  const isOfferPerformer = offer?.performer?.id === user?.id;
  const canParticipate = Boolean(isTaskOwner || isOfferPerformer);
  const latestCounterOffer = (counterOffersQuery.data ?? []).at(-1) ?? null;
  const isWaitingForCounterpart = latestCounterOffer?.status === "pending" && latestCounterOffer.author_user_id === user?.id;
  const canCreateCounterOffer = Boolean(
    offer
    && offer.status === "pending"
    && canParticipate
    && !isWaitingForCounterpart,
  );
  const actionableCounterOffer = latestCounterOffer?.status === "pending" && latestCounterOffer.author_user_id !== user?.id
    ? latestCounterOffer
    : null;

  const createCounterOfferMutation = useMutation({
    mutationFn: (payload: {
      message: string | null;
      payment_type: ApiPaymentType;
      price_amount: number | null;
      barter_description: string | null;
    }) => offersService.createCounterOffer(numericOfferId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.counterOffers(numericOfferId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast({
        title: "Контрпредложение отправлено",
        description: "Собеседник увидит новые условия в истории переговоров.",
      });
      setCounterMessage("");
      setCounterError(null);
    },
    onError: (error) => {
      setCounterError(error instanceof Error ? error.message : "Не удалось отправить контрпредложение");
    },
  });

  const acceptCounterOfferMutation = useMutation({
    mutationFn: offersService.acceptCounterOffer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.counterOffers(numericOfferId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast({
        title: "Условия подтверждены",
        description: "Финальные условия отклика обновлены.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось принять условия",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const rejectCounterOfferMutation = useMutation({
    mutationFn: offersService.rejectCounterOffer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.counterOffers(numericOfferId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.offers(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(numericTaskId) }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast({
        title: "Контрпредложение отклонено",
        description: "Раунд переговоров завершён без изменения условий.",
      });
    },
    onError: (error) => {
      toast({
        title: "Не удалось отклонить условия",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedMessage = counterMessage.trim();
    const normalizedPrice = Number(counterPriceValue);
    const normalizedBarter = counterBarterDescription.trim();

    if (counterPaymentType === "fixed_price" && (!counterPriceValue || Number.isNaN(normalizedPrice) || normalizedPrice <= 0)) {
      setCounterError("Для фиксированной цены укажите корректную сумму.");
      return;
    }

    if (counterPaymentType === "barter" && !normalizedBarter) {
      setCounterError("Для barter-обмена добавьте описание.");
      return;
    }

    setCounterError(null);
    await createCounterOfferMutation.mutateAsync({
      message: normalizedMessage || null,
      payment_type: counterPaymentType,
      price_amount: counterPaymentType === "fixed_price" ? normalizedPrice : null,
      barter_description: counterPaymentType === "barter" ? normalizedBarter : null,
    });
  };

  if (!hasValidParams) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6">
        <div className="card-surface p-6 max-w-md w-full">
          <h2 className="text-base font-semibold text-foreground">Некорректная ссылка на переговоры</h2>
          <Link to="/" className="inline-block mt-3 text-sm text-primary hover:text-primary/80">Вернуться к ленте</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1200px] mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Link to={`/task/${numericTaskId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Назад к задаче
          </Link>
          <span className="text-xs text-muted-foreground">Переговоры по отклику</span>
        </div>

        {(taskQuery.isLoading || offersQuery.isLoading) && (
          <div className="space-y-4">
            <div className="card-surface h-40 animate-pulse" />
            <div className="card-surface h-80 animate-pulse" />
          </div>
        )}

        {(!taskQuery.isLoading && taskQuery.isError) || (!offersQuery.isLoading && offersQuery.isError) ? (
          <div className="card-surface p-5">
            <h2 className="text-base font-semibold text-foreground">Не удалось загрузить переговоры</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {(taskQuery.error instanceof Error && taskQuery.error.message)
                || (offersQuery.error instanceof Error && offersQuery.error.message)
                || "Попробуйте обновить страницу."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void taskQuery.refetch();
                  void offersQuery.refetch();
                }}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Повторить
              </button>
              <Link
                to={`/task/${numericTaskId}`}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                К задаче
              </Link>
            </div>
          </div>
        ) : null}

        {!taskQuery.isLoading && !offersQuery.isLoading && !taskQuery.isError && !offersQuery.isError && taskQuery.data && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-5">
              <div className="card-surface p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Переговоры по условиям</div>
                    <h1 className="text-xl font-semibold text-foreground">{taskQuery.data.title}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {offer
                        ? `Отклик от ${offer.performer?.full_name ?? "исполнителя"} по задаче находится в статусе ${STATUS_LABELS[(taskQuery.data.status === "in_progress" ? "progress" : taskQuery.data.status === "completed" ? "done" : taskQuery.data.status) as keyof typeof STATUS_LABELS] ?? taskQuery.data.status}.`
                        : "Выбранный отклик не найден в текущем списке задачи."}
                    </p>
                  </div>
                  <Link
                    to={`/task/${numericTaskId}`}
                    className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    Открыть задачу
                  </Link>
                </div>

                {offer ? (
                  <div className="mt-5 rounded-lg bg-secondary p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{offer.performer?.full_name ?? "Исполнитель"}</div>
                      <span className="chip status-offers text-[11px] px-2 py-0.5">
                        {offer.status === "pending" ? "Переговоры открыты" : "Итог зафиксирован"}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{offer.message}</div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">Тип оплаты</div>
                        <div className="text-sm font-medium text-foreground">{PAYMENT_LABELS[offer.payment_type === "fixed_price" ? "money" : offer.payment_type === "barter" ? "exchange" : "offers"]}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">Сумма</div>
                        <div className="text-sm font-medium text-foreground">{offer.price_amount ? `${offer.price_amount} ₽` : "По договорённости"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">Бартер</div>
                        <div className="text-sm font-medium text-foreground">{offer.barter_description || "Нет"}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    Переговоры временно недоступны: сам отклик не найден. Вернитесь к задаче и обновите список откликов.
                  </div>
                )}
              </div>

              <div className="card-surface p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">История переговоров</h2>
                    <p className="text-xs text-muted-foreground mt-1">Здесь видно, кто и когда предлагал новые условия.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void counterOffersQuery.refetch()}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Обновить
                  </button>
                </div>

                {counterOffersQuery.isLoading && (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-24 rounded-lg bg-secondary animate-pulse" />
                    ))}
                  </div>
                )}

                {!counterOffersQuery.isLoading && counterOffersQuery.isError && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-foreground">
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

                {!counterOffersQuery.isLoading && !counterOffersQuery.isError && (counterOffersQuery.data ?? []).length === 0 && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    История пока пуста. Первый раунд начнётся, когда заказчик предложит уточнённые условия.
                  </div>
                )}

                {!counterOffersQuery.isLoading && !counterOffersQuery.isError && (
                  <div className="space-y-3">
                    {(counterOffersQuery.data ?? []).map((counterOffer) => {
                      const isOwn = counterOffer.author_user_id === user?.id;

                      return (
                        <div key={counterOffer.id} className="rounded-lg border border-border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-foreground">{isOwn ? "Ваш раунд" : "Раунд собеседника"}</div>
                              <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(counterOffer.created_at).toLocaleString("ru-RU")}
                              </div>
                            </div>
                            <span className={`chip text-[11px] px-2 py-0.5 ${getCounterStatusClass(counterOffer.status)}`}>
                              {COUNTER_STATUS_LABELS[counterOffer.status] ?? counterOffer.status}
                            </span>
                          </div>

                          {counterOffer.message && (
                            <div className="mt-3 text-sm text-foreground">{counterOffer.message}</div>
                          )}

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <div className="text-[11px] text-muted-foreground mb-1">Тип оплаты</div>
                              <div className="text-sm font-medium text-foreground">
                                {counterOffer.payment_type === "fixed_price"
                                  ? "Фиксированная цена"
                                  : counterOffer.payment_type === "barter"
                                    ? "Бартер"
                                    : "Договорная"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-muted-foreground mb-1">Сумма</div>
                              <div className="text-sm font-medium text-foreground">
                                {counterOffer.price_amount ? `${counterOffer.price_amount} ₽` : "По договорённости"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-muted-foreground mb-1">Бартер</div>
                              <div className="text-sm font-medium text-foreground">{counterOffer.barter_description || "Нет"}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card-surface p-5 xl:sticky xl:top-20">
                <h2 className="text-sm font-semibold text-foreground">Следующий шаг</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {actionableCounterOffer
                    ? "Сейчас мяч на вашей стороне: можно принять встречные условия, отклонить их или предложить новую редакцию."
                    : isWaitingForCounterpart
                      ? "Ваши условия уже отправлены. Теперь ждём ответа второй стороны."
                      : canCreateCounterOffer
                        ? "Если нужно уточнить стоимость, сроки или формат оплаты, отправьте следующий раунд переговоров."
                        : "Сейчас переговоры доступны только участникам отклика, пока он остаётся активным."}
                </p>

                <div className="mt-4 space-y-2">
                  {actionableCounterOffer && (
                    <>
                      <button
                        type="button"
                        onClick={() => acceptCounterOfferMutation.mutate(actionableCounterOffer.id)}
                        className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        disabled={acceptCounterOfferMutation.isPending}
                      >
                        {acceptCounterOfferMutation.isPending ? "Подтверждаем..." : "Принять условия"}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectCounterOfferMutation.mutate(actionableCounterOffer.id)}
                        className="w-full h-11 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
                        disabled={rejectCounterOfferMutation.isPending}
                      >
                        {rejectCounterOfferMutation.isPending ? "Отклоняем..." : "Отклонить условия"}
                      </button>
                    </>
                  )}

                  <Link
                    to={`/task/${numericTaskId}?panel=chat`}
                    className="inline-flex w-full h-11 items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-accent transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Открыть чат по задаче
                  </Link>
                </div>

                {canCreateCounterOffer && offer && (
                  <form className="mt-5 space-y-3 border-t border-border pt-5" onSubmit={handleSubmit}>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий к новому раунду</label>
                      <textarea
                        rows={4}
                        value={counterMessage}
                        onChange={(event) => {
                          setCounterMessage(event.target.value);
                          if (counterError) {
                            setCounterError(null);
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Например: могу закрыть задачу сегодня до 20:00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Тип оплаты</label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        <button
                          type="button"
                          onClick={() => setCounterPaymentType("fixed_price")}
                          className={`chip justify-center text-xs ${counterPaymentType === "fixed_price" ? "chip-active" : "chip-inactive"}`}
                        >
                          Фиксированная цена
                        </button>
                        <button
                          type="button"
                          onClick={() => setCounterPaymentType("negotiable")}
                          className={`chip justify-center text-xs ${counterPaymentType === "negotiable" ? "chip-active" : "chip-inactive"}`}
                        >
                          Договорная
                        </button>
                        <button
                          type="button"
                          onClick={() => setCounterPaymentType("barter")}
                          className={`chip justify-center text-xs ${counterPaymentType === "barter" ? "chip-active" : "chip-inactive"}`}
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
                            if (counterError) {
                              setCounterError(null);
                            }
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
                          if (counterError) {
                            setCounterError(null);
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Опишите, что предлагаете взамен"
                      />
                    )}

                    {counterError && <p className="text-xs text-destructive">{counterError}</p>}

                    <button
                      type="submit"
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      disabled={createCounterOfferMutation.isPending}
                    >
                      {createCounterOfferMutation.isPending ? "Отправляем..." : "Отправить новый раунд"}
                    </button>
                  </form>
                )}

                {!canCreateCounterOffer && isWaitingForCounterpart && (
                  <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                    Сейчас ваш ход завершён. Когда вторая сторона ответит, здесь снова появятся действия.
                  </div>
                )}

                {!canParticipate && (
                  <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                    Просматривать переговоры и менять условия могут только заказчик и автор отклика.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
