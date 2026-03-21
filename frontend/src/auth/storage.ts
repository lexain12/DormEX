const ACCESS_TOKEN_KEY = "campus_exchange.access_token";
const REFRESH_TOKEN_KEY = "campus_exchange.refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}

export function getAccessToken(): string | null {
  return readStorage(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readStorage(REFRESH_TOKEN_KEY);
}

export function hasAuthTokens(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

export function setAuthTokens(tokens: AuthTokens): void {
  writeStorage(ACCESS_TOKEN_KEY, tokens.accessToken);
  writeStorage(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearAuthTokens(): void {
  removeStorage(ACCESS_TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
}
