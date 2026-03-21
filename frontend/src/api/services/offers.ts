import { apiRequest } from "@/api/client";
import type {
  CounterOfferDto,
  CreateCounterOfferPayload,
  CreateOfferPayload,
  OfferDto,
  UpdateOfferPayload,
} from "@/api/types";

export const offersService = {
  listByTask: async (taskId: number) => {
    const response = await apiRequest<OfferDto[] | { items: OfferDto[] }>(`/tasks/${taskId}/offers`);

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  createForTask: (taskId: number, payload: CreateOfferPayload) => apiRequest<OfferDto>(`/tasks/${taskId}/offers`, {
    method: "POST",
    body: payload,
  }),

  update: (offerId: number, payload: UpdateOfferPayload) => apiRequest<OfferDto>(`/offers/${offerId}`, {
    method: "PATCH",
    body: payload,
  }),

  withdraw: (offerId: number) => apiRequest<{ status?: string }>(`/offers/${offerId}/withdraw`, {
    method: "POST",
  }),

  accept: (offerId: number) => apiRequest<{ task_id?: number; assignment_id?: number; chat_id?: number; status?: string }>(`/offers/${offerId}/accept`, {
    method: "POST",
  }),

  reject: (offerId: number) => apiRequest<{ status?: string }>(`/offers/${offerId}/reject`, {
    method: "POST",
  }),

  listCounterOffers: async (offerId: number) => {
    const response = await apiRequest<CounterOfferDto[] | { items: CounterOfferDto[] }>(`/offers/${offerId}/counter-offers`);

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  createCounterOffer: (offerId: number, payload: CreateCounterOfferPayload) => apiRequest<CounterOfferDto>(`/offers/${offerId}/counter-offers`, {
    method: "POST",
    body: payload,
  }),

  acceptCounterOffer: (counterOfferId: number) => apiRequest<{ status?: string }>(`/counter-offers/${counterOfferId}/accept`, {
    method: "POST",
  }),

  rejectCounterOffer: (counterOfferId: number) => apiRequest<{ status?: string }>(`/counter-offers/${counterOfferId}/reject`, {
    method: "POST",
  }),
};
