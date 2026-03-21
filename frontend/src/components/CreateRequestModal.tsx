import { X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tasksService } from "@/api/services/tasks";
import { useAuth } from "@/context/auth-context";
import { useInteractionStore } from "@/context/interaction-store";
import { CATEGORIES, URGENCY_LABELS, type Urgency } from "@/lib/data";
import { mapUiPaymentModeToApi, mapUiUrgencyToApi } from "@/lib/task-mappers";
import { toast } from "@/hooks/use-toast";

interface CreateRequestModalProps {
  open: boolean;
  onClose: () => void;
}

type VisibilityMode = "dorm" | "campus" | "floor";
type PaymentMode = "fixed" | "offers" | "barter";

const CATEGORY_OPTIONS = CATEGORIES.filter((category) => category.id !== "all");

export function CreateRequestModal({ open, onClose }: CreateRequestModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedDorm } = useInteractionStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]?.id ?? "other");
  const [urgency, setUrgency] = useState<Urgency>("none");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("fixed");
  const [price, setPrice] = useState("");
  const [barterDescription, setBarterDescription] = useState("");
  const [visibility, setVisibility] = useState<VisibilityMode>("dorm");
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    price?: string;
    barter?: string;
    dormitory?: string;
  }>({});

  const createTaskMutation = useMutation({
    mutationFn: tasksService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Заявка опубликована",
        description: "Она уже доступна в ленте задач.",
      });
      handleClose();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Не удалось создать заявку";
      toast({
        title: "Ошибка публикации",
        description: message,
        variant: "destructive",
      });
    },
  });

  const visibilityLabel = useMemo(() => {
    const currentDormLabel = user?.dormitory?.name ?? selectedDorm;

    if (visibility === "campus") {
      return "Весь кампус";
    }

    if (visibility === "floor") {
      return `${currentDormLabel}, мой этаж`;
    }

    return currentDormLabel;
  }, [selectedDorm, user?.dormitory?.name, visibility]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory(CATEGORY_OPTIONS[0]?.id ?? "other");
    setUrgency("none");
    setPaymentMode("fixed");
    setPrice("");
    setBarterDescription("");
    setVisibility("dorm");
    setErrors({});
  };

  const handleClose = () => {
    if (createTaskMutation.isPending) {
      return;
    }

    resetForm();
    onClose();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: {
      title?: string;
      description?: string;
      price?: string;
      barter?: string;
      dormitory?: string;
    } = {};

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const normalizedBarterDescription = barterDescription.trim();

    if (!normalizedTitle) {
      nextErrors.title = "Укажите заголовок заявки";
    }

    if (!normalizedDescription) {
      nextErrors.description = "Добавьте описание, чтобы исполнителю было понятно задание";
    }

    if (paymentMode === "fixed") {
      const parsed = Number(price);
      if (!price || Number.isNaN(parsed) || parsed <= 0) {
        nextErrors.price = "Введите корректную цену";
      }
    }

    if (paymentMode === "barter" && !normalizedBarterDescription) {
      nextErrors.barter = "Опишите, что вы предлагаете взамен";
    }

    if (!user?.dormitory?.id) {
      nextErrors.dormitory = "В профиле не выбрано общежитие. Завершите onboarding.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    createTaskMutation.mutate({
      title: normalizedTitle,
      description: normalizedDescription,
      category,
      urgency: mapUiUrgencyToApi(urgency),
      payment_type: mapUiPaymentModeToApi(paymentMode),
      price_amount: paymentMode === "fixed" ? Number(price) : null,
      barter_description: paymentMode === "barter" ? normalizedBarterDescription : null,
      visibility: visibility === "campus" ? "university" : "dormitory",
      dormitory_id: user?.dormitory?.id ?? null,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative card-surface w-full max-w-lg rounded-t-2xl border-b-0 p-4 pb-5 max-h-[92vh] overflow-y-auto animate-fade-in sm:mx-4 sm:rounded-xl sm:border sm:p-6 sm:pb-6 sm:max-h-[90vh]">
        <div className="mb-5 flex items-center justify-between sm:mb-6">
          <h2 className="text-lg font-semibold text-foreground">Создать заявку</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
            type="button"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Заголовок</label>
            <input
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="Кратко опишите, что нужно сделать"
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.title ? (
              <p className="text-[11px] text-destructive mt-1">{errors.title}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">Хороший заголовок получает больше откликов</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Описание</label>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="Подробно опишите задачу, условия, сроки..."
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            {errors.description && <p className="text-[11px] text-destructive mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Категория</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Срочность</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["urgent", "today", "week", "none"] as const).map((itemUrgency) => (
                <button
                  key={itemUrgency}
                  className={`chip text-xs flex-1 justify-center ${itemUrgency === urgency ? "chip-active" : "chip-inactive"}`}
                  onClick={() => setUrgency(itemUrgency)}
                  type="button"
                >
                  {URGENCY_LABELS[itemUrgency]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Оплата</label>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={() => setPaymentMode("fixed")}
                className={`chip flex-1 justify-center text-xs ${paymentMode === "fixed" ? "chip-active" : "chip-inactive"}`}
                type="button"
              >
                Фиксированная цена
              </button>
              <button
                onClick={() => setPaymentMode("offers")}
                className={`chip flex-1 justify-center text-xs ${paymentMode === "offers" ? "chip-active" : "chip-inactive"}`}
                type="button"
              >
                Договорная
              </button>
              <button
                onClick={() => setPaymentMode("barter")}
                className={`chip flex-1 justify-center text-xs ${paymentMode === "barter" ? "chip-active" : "chip-inactive"}`}
                type="button"
              >
                Бартер
              </button>
            </div>

            {paymentMode === "fixed" && (
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
                  }}
                  placeholder="0"
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
              </div>
            )}

            {paymentMode === "barter" && (
              <textarea
                rows={3}
                value={barterDescription}
                onChange={(event) => {
                  setBarterDescription(event.target.value);
                  if (errors.barter) setErrors((prev) => ({ ...prev, barter: undefined }));
                }}
                placeholder="Например: взамен помогу с печатью конспектов"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            )}

            {errors.price && <p className="text-[11px] text-destructive mt-1">{errors.price}</p>}
            {errors.barter && <p className="text-[11px] text-destructive mt-1">{errors.barter}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Видимость</label>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as VisibilityMode)}
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              <option value="dorm">Моё общежитие ({user?.dormitory?.name ?? selectedDorm})</option>
              <option value="campus">Весь кампус</option>
              <option value="floor">Только мой этаж</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">Публикация: {visibilityLabel}</p>
            {errors.dormitory && <p className="text-[11px] text-destructive mt-1">{errors.dormitory}</p>}
          </div>

          <button
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
            disabled={createTaskMutation.isPending}
          >
            {createTaskMutation.isPending ? "Публикуем..." : "Создать заявку"}
          </button>
        </form>
      </div>
    </div>
  );
}
