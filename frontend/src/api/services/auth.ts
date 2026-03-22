import { apiRequest } from "@/api/client";
import type {
  AuthLoginResponse,
  AuthRequestCodeResponse,
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
  login: (username: string, password: string) => apiRequest<AuthLoginResponse>("/auth/login", {
    method: "POST",
    authMode: "none",
    body: { username, password },
  }),

  register: (
    email: string,
    username: string,
    password: string,
    dormitoryId: number,
    fullName?: string,
  ) => apiRequest<AuthLoginResponse>("/auth/register", {
    method: "POST",
    authMode: "none",
    body: {
      email,
      username,
      password,
      dormitory_id: dormitoryId,
      full_name: fullName?.trim() || undefined,
    },
  }),

  requestCode: (email: string) => apiRequest<AuthRequestCodeResponse>("/auth/email/request-code", {
    method: "POST",
    authMode: "none",
    body: { email },
  }),

  verifyCode: (email: string, code: string) => apiRequest<AuthLoginResponse>("/auth/email/verify-code", {
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

  getRegistrationDormitories: async (email: string) => {
    const response = await apiRequest<DormitoryShort[] | { items: DormitoryShort[] }>("/auth/dormitories", {
      authMode: "none",
      query: { email },
    });

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
