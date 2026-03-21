import { apiRequest } from "@/api/client";
import type {
  NotificationsResponse,
  UnreadCountResponse,
} from "@/api/types";

interface ListNotificationsParams {
  status?: "all" | "unread";
  limit?: number;
  offset?: number;
}

export const notificationsService = {
  list: (params: ListNotificationsParams = {}) => apiRequest<NotificationsResponse>("/notifications", {
    query: params,
  }),

  unreadCount: () => apiRequest<UnreadCountResponse>("/notifications/unread-count"),

  markRead: (notificationId: number) => apiRequest<{ status?: string }>(`/notifications/${notificationId}/read`, {
    method: "POST",
  }),

  markAllRead: () => apiRequest<{ status?: string }>("/notifications/read-all", {
    method: "POST",
  }),
};
