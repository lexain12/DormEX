import { apiRequest } from "@/api/client";
import type { CategoryAnalyticsDto, CategoryDealsDto } from "@/api/types";

export const analyticsService = {
  getCategory: (category: string) => apiRequest<CategoryAnalyticsDto>(`/analytics/categories/${category}`),
  getCategoryDeals: (category: string, limit = 24) => apiRequest<CategoryDealsDto>(`/analytics/categories/${category}/deals`, {
    query: { limit },
  }),
};
