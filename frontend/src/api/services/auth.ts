import { apiRequest } from "@/api/client";
import type {
  AuthRequestCodeResponse,
  AuthVerifyCodeResponse,
  DormitoryShort,
  MeUser,
} from "@/api/types";

export interface UpdateMePayload {
  full_name: string;
  dormitory_id: number;
  room_label?: string;
  bio?: string;
}

export const authService = {
  requestCode: (email: string) => apiRequest<AuthRequestCodeResponse>("/auth/email/request-code", {
    method: "POST",
    authMode: "none",
    body: { email },
  }),

  verifyCode: (email: string, code: string) => apiRequest<AuthVerifyCodeResponse>("/auth/email/verify-code", {
    method: "POST",
    authMode: "none",
    body: { email, code },
  }),

  getMe: () => apiRequest<MeUser>("/me"),

  updateMe: (payload: UpdateMePayload) => apiRequest<MeUser>("/me", {
    method: "PATCH",
    body: payload,
  }),

  getDormitories: async () => {
    const response = await apiRequest<DormitoryShort[] | { items: DormitoryShort[] }>("/reference/dormitories");

    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? [];
  },

  logout: () => apiRequest<{ status?: string }>("/auth/logout", {
    method: "POST",
    authMode: "refresh",
  }),
};
