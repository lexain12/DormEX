export type TaskStatus = "open" | "offers" | "progress" | "done" | "cancelled";
export type Urgency = "urgent" | "today" | "week" | "none";
export type PaymentType = "money" | "exchange" | "offers";

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryIcon: string;
  dorm: string;
  status: TaskStatus;
  urgency: Urgency;
  paymentType: PaymentType;
  price?: number;
  barterDescription?: string | null;
  offersCount: number;
  requesterName: string;
  requesterRating: number;
  requesterCompletedTasksCount?: number;
  requesterAvatar: string;
  createdAt: string;
}

export function getTaskCompensationLabel(task: Pick<Task, "paymentType" | "price" | "barterDescription">): string {
  if (task.paymentType === "money") {
    return typeof task.price === "number" ? `${task.price} ₽` : "Цена уточняется";
  }

  if (task.paymentType === "exchange") {
    return task.barterDescription?.trim() || "Услуга взамен";
  }

  return "По договорённости";
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Открыта",
  offers: "Есть предложения",
  progress: "В работе",
  done: "Завершена",
  cancelled: "Отменена",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  urgent: "Срочно",
  today: "Сегодня",
  week: "На неделе",
  none: "Без срока",
};

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  money: "Деньги",
  exchange: "Услуга взамен",
  offers: "Договорная",
};

export const CATEGORIES = [
  { id: "all", label: "Все", icon: "📋" },
  { id: "delivery", label: "Доставка", icon: "🚀" },
  { id: "moving", label: "Перенос вещей", icon: "📦" },
  { id: "cleaning", label: "Уборка", icon: "🧹" },
  { id: "tech_help", label: "Техпомощь", icon: "💻" },
  { id: "study_help", label: "Учебная помощь", icon: "📚" },
  { id: "other", label: "Другое", icon: "✨" },
];
