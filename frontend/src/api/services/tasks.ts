import { apiRequest } from "@/api/client";
import type {
  CreateTaskPayload,
  TaskReviewDto,
  TaskDetailDto,
  TaskListItemDto,
  UserTaskDto,
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

interface MyTasksParams {
  role?: "customer" | "performer";
  status?: "active" | "completed" | "cancelled";
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

  listMyTasks: async (params: MyTasksParams = {}) => {
    const response = await apiRequest<UserTaskDto[] | { items: UserTaskDto[] }>("/me/tasks", {
      query: params,
    });

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  cancel: (taskId: number, reason: string) => apiRequest<{ status?: string }>(`/tasks/${taskId}/cancel`, {
    method: "POST",
    body: { reason },
  }),

  confirmCompletion: (taskId: number) => apiRequest<{ status?: string }>(`/tasks/${taskId}/confirm-completion`, {
    method: "POST",
  }),

  listReviews: async (taskId: number) => {
    const response = await apiRequest<TaskReviewDto[] | { items: TaskReviewDto[] }>(`/tasks/${taskId}/reviews`);

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  createReview: (taskId: number, payload: { rating: number; comment: string | null }) => apiRequest<TaskReviewDto>(`/tasks/${taskId}/reviews`, {
    method: "POST",
    body: payload,
  }),
};
