import { apiRequest } from "@/api/client";
import type {
  CreateTaskPayload,
  TaskDetailDto,
  TaskListItemDto,
  TaskListResponse,
} from "@/api/types";

interface ListTasksParams {
  scope?: "university" | "dormitory";
  dormitory_id?: number;
  category?: string;
  status?: string;
  urgency?: string;
  payment_type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const tasksService = {
  list: async (params: ListTasksParams = {}) => {
    const response = await apiRequest<TaskListResponse | TaskListItemDto[]>("/tasks", {
      query: params,
    });

    if (Array.isArray(response)) {
      return {
        items: response,
        total: response.length,
        limit: params.limit ?? response.length,
        offset: params.offset ?? 0,
      };
    }

    return response;
  },

  getById: (taskId: number) => apiRequest<TaskDetailDto>(`/tasks/${taskId}`),

  create: (payload: CreateTaskPayload) => apiRequest<TaskDetailDto>("/tasks", {
    method: "POST",
    body: payload,
  }),

  cancel: (taskId: number, reason: string) => apiRequest<{ status?: string }>(`/tasks/${taskId}/cancel`, {
    method: "POST",
    body: { reason },
  }),

  completeRequest: (taskId: number) => apiRequest<{ task_id?: number; confirmation_status?: string }>(`/tasks/${taskId}/complete-request`, {
    method: "POST",
  }),

  confirmCompletion: (taskId: number) => apiRequest<{ status?: string }>(`/tasks/${taskId}/confirm-completion`, {
    method: "POST",
  }),

  openDispute: (taskId: number, comment: string) => apiRequest<{ status?: string }>(`/tasks/${taskId}/open-dispute`, {
    method: "POST",
    body: { comment },
  }),
};
