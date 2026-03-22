import { useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/api/client";
import { getAccessToken } from "@/auth/storage";

type RealtimeParamValue = string | number | boolean | null | undefined;

interface RealtimeChannelOptions<TMessage> {
  enabled?: boolean;
  path: string;
  params?: Record<string, RealtimeParamValue>;
  onMessage: (message: TMessage) => void;
}

function buildRealtimeUrl(path: string, params?: Record<string, RealtimeParamValue>): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const apiUrl = new URL(API_BASE_URL, window.location.origin);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const normalizedBasePath = apiUrl.pathname.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const websocketUrl = new URL(
    `${normalizedBasePath}${normalizedPath}`,
    `${wsProtocol}//${apiUrl.host}`,
  );

  const accessToken = getAccessToken();
  if (accessToken) {
    websocketUrl.searchParams.set("access_token", accessToken);
  }

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    websocketUrl.searchParams.set(key, String(value));
  });

  return websocketUrl.toString();
}

export function useRealtimeChannel<TMessage>({
  enabled = true,
  path,
  params,
  onMessage,
}: RealtimeChannelOptions<TMessage>): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  onMessageRef.current = onMessage;

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const normalizedParams = useMemo<Record<string, RealtimeParamValue>>(
    () => JSON.parse(paramsKey) as Record<string, RealtimeParamValue>,
    [paramsKey],
  );

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return undefined;
    }

    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let currentSocket: WebSocket | null = null;
    let isDisposed = false;

    const connect = () => {
      const url = buildRealtimeUrl(path, normalizedParams);
      if (!url || isDisposed) {
        return;
      }

      const socket = new WebSocket(url);
      currentSocket = socket;

      socket.onopen = () => {
        if (isDisposed || currentSocket !== socket) {
          return;
        }

        reconnectAttempt = 0;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        if (isDisposed || currentSocket !== socket) {
          return;
        }

        try {
          onMessageRef.current(JSON.parse(event.data) as TMessage);
        } catch {
          // Ignore malformed realtime payloads and keep the socket alive.
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        if (currentSocket === socket) {
          currentSocket = null;
        }

        if (isDisposed) {
          return;
        }

        setIsConnected(false);
        reconnectAttempt += 1;
        const delayMs = Math.min(1000 * 2 ** (reconnectAttempt - 1), 10_000);
        reconnectTimer = window.setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      setIsConnected(false);

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      currentSocket?.close();
      currentSocket = null;
    };
  }, [enabled, normalizedParams, path]);

  return { isConnected };
}
