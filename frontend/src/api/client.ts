import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/auth/storage";
import type { ApiErrorShape, AuthVerifyCodeResponse } from "@/api/types";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code = "request_failed", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type AuthMode = "access" | "refresh" | "none";

interface RequestOptions extends Omit<RequestInit, "body"> {
  authMode?: AuthMode;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  disableRefreshRetry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

function buildQuery(query?: Record<string, string | number | boolean | null | undefined>): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorShape | null = null;

  try {
    body = (await parseResponse<ApiErrorShape>(response)) ?? null;
  } catch {
    body = null;
  }

  const code = body?.error?.code ?? "request_failed";
  const message = body?.error?.message ?? body?.detail ?? `Request failed (${response.status})`;
  const details = body?.error?.details;

  return new ApiError(message, response.status, code, details);
}

function getTokenByMode(authMode: AuthMode): string | null {
  if (authMode === "access") {
    return getAccessToken();
  }

  if (authMode === "refresh") {
    return getRefreshToken();
  }

  return null;
}

async function runFetch<T>(path: string, options: RequestOptions = {}): Promise<{ response: Response; data?: T }> {
  const {
    authMode = "access",
    body,
    headers,
    query,
    ...rest
  } = options;

  const token = getTokenByMode(authMode);
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
    ...rest,
    headers: finalHeaders,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    return { response };
  }

  const data = await parseResponse<T>(response);
  return { response, data };
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { response, data } = await runFetch<AuthVerifyCodeResponse | { access_token?: string; refresh_token?: string }>("/auth/refresh", {
          method: "POST",
          authMode: "refresh",
          body: { refresh_token: refreshToken },
        });

        if (!response.ok || !data) {
          clearAuthTokens();
          return null;
        }

        const nextAccess = data.access_token;
        const nextRefresh = data.refresh_token ?? refreshToken;

        if (!nextAccess) {
          clearAuthTokens();
          return null;
        }

        setAuthTokens({ accessToken: nextAccess, refreshToken: nextRefresh });
        return nextAccess;
      } catch {
        clearAuthTokens();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authMode = "access", disableRefreshRetry = false } = options;

  const firstAttempt = await runFetch<T>(path, options);

  if (firstAttempt.response.ok) {
    return firstAttempt.data as T;
  }

  if (
    firstAttempt.response.status === 401 &&
    authMode === "access" &&
    !disableRefreshRetry
  ) {
    const nextAccessToken = await refreshAccessToken();

    if (nextAccessToken) {
      const secondAttempt = await runFetch<T>(path, {
        ...options,
        disableRefreshRetry: true,
      });

      if (secondAttempt.response.ok) {
        return secondAttempt.data as T;
      }

      throw await parseError(secondAttempt.response);
    }
  }

  throw await parseError(firstAttempt.response);
}
