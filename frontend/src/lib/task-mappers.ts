import type {
  ApiPaymentType,
  ApiTaskStatus,
  ApiUrgency,
  NotificationDto,
  TaskDetailDto,
  TaskListItemDto,
} from "@/api/types";
import { CATEGORIES, type PaymentType, type Task, type TaskStatus, type Urgency } from "@/lib/data";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "--";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getRelativeTime(isoDate: string): string {
  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    return "недавно";
  }

  const diffMs = Date.now() - timestamp;

  if (diffMs < 60_000) {
    return "только что";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн назад`;
}

export function mapApiStatusToUi(status: ApiTaskStatus): TaskStatus {
  if (status === "in_progress") {
    return "progress";
  }

  if (status === "completed") {
    return "done";
  }

  return status;
}

export function mapApiUrgencyToUi(urgency: ApiUrgency): Urgency {
  if (urgency === "this_week") {
    return "week";
  }

  if (urgency === "flexible") {
    return "none";
  }

  return urgency;
}

export function mapUiUrgencyToApi(urgency: Urgency): ApiUrgency {
  if (urgency === "week") {
    return "this_week";
  }

  if (urgency === "none") {
    return "flexible";
  }

  return urgency;
}

export function mapApiPaymentToUi(paymentType: ApiPaymentType): PaymentType {
  if (paymentType === "fixed_price") {
    return "money";
  }

  if (paymentType === "barter") {
    return "exchange";
  }

  return "offers";
}

export function mapTaskDtoToUi(task: TaskListItemDto | TaskDetailDto): Task {
  const categoryMeta = CATEGORIES.find((category) => category.id === task.category);
  const requesterName = task.customer?.full_name ?? "Пользователь";

  return {
    id: String(task.id),
    title: task.title,
    description: task.description,
    category: task.category,
    categoryIcon: categoryMeta?.icon ?? "📋",
    dorm: task.dormitory?.name ?? "Общежитие не указано",
    status: mapApiStatusToUi(task.status),
    urgency: mapApiUrgencyToUi(task.urgency),
    paymentType: mapApiPaymentToUi(task.payment_type),
    price: task.price_amount ?? undefined,
    offersCount: task.offers_count ?? 0,
    requesterName,
    requesterRating: Number(task.customer?.rating_avg ?? 0),
    requesterAvatar: getInitials(requesterName),
    createdAt: getRelativeTime(task.created_at),
  };
}

export function mapUiPaymentModeToApi(mode: "fixed" | "offers" | "barter"): ApiPaymentType {
  if (mode === "fixed") {
    return "fixed_price";
  }

  if (mode === "barter") {
    return "barter";
  }

  return "negotiable";
}

export function resolveNotificationTaskId(notification: NotificationDto): string | null {
  const payloadTaskId = notification.payload && typeof notification.payload.task_id === "number"
    ? notification.payload.task_id
    : null;

  if (payloadTaskId) {
    return String(payloadTaskId);
  }

  if (notification.entity_type === "task" && notification.entity_id) {
    return String(notification.entity_id);
  }

  return null;
}

export function formatEventTime(isoDate: string): string {
  return getRelativeTime(isoDate);
}
