import { apiRequest } from "@/api/client";
import type {
  ChatDto,
  ChatMessageDto,
  ChatMessagesResponse,
} from "@/api/types";

interface ListMessagesParams {
  limit?: number;
  before_message_id?: number;
}

export const chatsService = {
  list: async () => {
    const response = await apiRequest<ChatDto[] | { items: ChatDto[] }>("/chats");

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  getById: (chatId: number) => apiRequest<ChatDto>(`/chats/${chatId}`),

  listMessages: async (chatId: number, params: ListMessagesParams = {}) => {
    const response = await apiRequest<ChatMessagesResponse | ChatMessageDto[]>(`/chats/${chatId}/messages`, {
      query: params,
    });

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? response.messages ?? [];
  },

  sendMessage: (chatId: number, body: string) => apiRequest<ChatMessageDto>(`/chats/${chatId}/messages`, {
    method: "POST",
    body: { body },
  }),

  markRead: (chatId: number) => apiRequest<{ status?: string }>(`/chats/${chatId}/read`, {
    method: "POST",
  }),
};
