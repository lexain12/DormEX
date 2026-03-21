import { apiRequest } from "@/api/client";
import type { CategoryAnalyticsDto } from "@/api/types";

export const analyticsService = {
  getCategory: (category: string) => apiRequest<CategoryAnalyticsDto>(`/analytics/categories/${category}`),
};
