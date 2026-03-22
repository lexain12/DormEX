import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { authService, type UpdateMePayload } from "@/api/services/auth";
import type { MeUser } from "@/api/types";
import { ApiError } from "@/api/client";
import { clearAuthTokens, hasAuthTokens, setAuthTokens } from "@/auth/storage";

const DEV_SESSION_STORAGE_KEY = "campus_exchange.dev_session_user";
const SESSION_USER_STORAGE_KEY = "campus_exchange.session_user";

interface RequestCodeMeta {
  status: string;
  expiresInSec: number;
}

interface AuthContextValue {
  status: "loading" | "anonymous" | "authenticated";
  user: MeUser | null;
  profileCompleted: boolean;
  canUseDevSession: boolean;
  startDevSession: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, dormitoryId: number, fullName?: string) => Promise<void>;
  requestCode: (email: string) => Promise<RequestCodeMeta>;
  verifyCode: (email: string, code: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  completeProfile: (payload: UpdateMePayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isProfileCompleted(user: MeUser | null): boolean {
  if (!user) {
    return false;
  }

  if (typeof user.profile_completed === "boolean") {
    return user.profile_completed;
  }

  return Boolean(user.full_name && user.dormitory?.id);
}

function getDevFallbackUser(): MeUser {
  return {
    id: -1,
    email: "dev@local.test",
    full_name: "Локальный тестовый пользователь",
    role: "student",
    university: {
      id: 1,
      name: "Dev University",
    },
    dormitory: {
      id: 1,
      name: "Общежитие №1",
    },
    profile_completed: true,
  };
}

function readDevSessionUser(): MeUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(DEV_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MeUser;
  } catch {
    return null;
  }
}

function writeDevSessionUser(user: MeUser): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(user));
}

function clearDevSessionUser(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
}

function readSessionUser(): MeUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MeUser;
  } catch {
    return null;
  }
}

function writeSessionUser(user: MeUser): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(user));
}

function clearSessionUser(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_USER_STORAGE_KEY);
}

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "anonymous" | "authenticated">("loading");
  const [user, setUser] = useState<MeUser | null>(null);
  const canUseDevSession = import.meta.env.DEV;

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (canUseDevSession) {
        const devUser = readDevSessionUser();

        if (devUser) {
          if (!cancelled) {
            setStatus("authenticated");
            setUser(devUser);
          }
          return;
        }
      }

      if (!hasAuthTokens()) {
        clearSessionUser();
        if (!cancelled) {
          setStatus("anonymous");
          setUser(null);
        }
        return;
      }

      try {
        const me = await authService.getMe();
        writeSessionUser(me);

        if (!cancelled) {
          setUser(me);
          setStatus("authenticated");
        }
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens();
          clearSessionUser();

          if (!cancelled) {
            setUser(null);
            setStatus("anonymous");
          }
          return;
        }

        const cachedUser = readSessionUser();

        if (!cancelled) {
          if (cachedUser) {
            setUser(cachedUser);
            setStatus("authenticated");
          } else {
            setUser(null);
            setStatus("anonymous");
          }
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [canUseDevSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    profileCompleted: isProfileCompleted(user),
    canUseDevSession,

    startDevSession: () => {
      if (!canUseDevSession) {
        return;
      }

      const devUser = getDevFallbackUser();
      writeDevSessionUser(devUser);
      clearAuthTokens();
      clearSessionUser();
      setUser(devUser);
      setStatus("authenticated");
    },

    login: async (username: string, password: string) => {
      const response = await authService.login(username, password);
      if (!response.access_token || !response.refresh_token) {
        throw new ApiError("Не удалось получить токены сессии", 500, "missing_tokens");
      }

      setAuthTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      });
      clearDevSessionUser();

      const me = response.user ?? await authService.getMe();
      writeSessionUser(me);

      setUser(me);
      setStatus("authenticated");
    },

    register: async (email: string, username: string, password: string, dormitoryId: number, fullName?: string) => {
      const response = await authService.register(email, username, password, dormitoryId, fullName);
      if (!response.access_token || !response.refresh_token) {
        throw new ApiError("Не удалось получить токены сессии", 500, "missing_tokens");
      }

      setAuthTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      });
      clearDevSessionUser();

      const me = response.user ?? await authService.getMe();
      writeSessionUser(me);

      setUser(me);
      setStatus("authenticated");
    },

    requestCode: async (email: string) => {
      const response = await authService.requestCode(email);

      return {
        status: response.status,
        expiresInSec: response.expires_in_sec,
      };
    },

    verifyCode: async (email: string, code: string) => {
      const response = await authService.verifyCode(email, code);

      if (!response.access_token || !response.refresh_token) {
        throw new ApiError("Не удалось получить токены сессии", 500, "missing_tokens");
      }

      setAuthTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      });
      clearDevSessionUser();

      const me = response.user ?? await authService.getMe();
      writeSessionUser(me);

      setUser(me);
      setStatus("authenticated");
    },

    refreshMe: async () => {
      const me = await authService.getMe();
      writeSessionUser(me);
      setUser(me);
      setStatus("authenticated");
    },

    completeProfile: async (payload: UpdateMePayload) => {
      await authService.updateMe(payload);
      const me = await authService.getMe();
      writeSessionUser(me);
      setUser(me);
      setStatus("authenticated");
    },

    logout: async () => {
      try {
        await authService.logout();
      } catch {
        // Ignore API logout errors and always clear local session.
      } finally {
        clearAuthTokens();
        clearDevSessionUser();
        clearSessionUser();
        setUser(null);
        setStatus("anonymous");
      }
    },
  }), [status, user, canUseDevSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
