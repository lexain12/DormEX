import { apiRequest } from "@/api/client";
import type {
  UserProfileDto,
  UserReviewDto,
  UserTaskDto,
} from "@/api/types";

interface UserTasksParams {
  role?: "customer" | "performer";
  status?: "active" | "completed" | "cancelled";
}

export const usersService = {
  getById: (userId: number) => apiRequest<UserProfileDto>(`/users/${userId}`),

  getReviews: async (userId: number) => {
    const response = await apiRequest<UserReviewDto[] | { items: UserReviewDto[] }>(`/users/${userId}/reviews`);

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  getTasks: async (userId: number, params: UserTasksParams) => {
    const response = await apiRequest<UserTaskDto[] | { items: UserTaskDto[] }>(`/users/${userId}/tasks`, {
      query: params,
    });

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },
};
