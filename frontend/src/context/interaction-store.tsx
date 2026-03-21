import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

interface InteractionStoreContextValue {
  selectedDorm: string;
  setSelectedDorm: (dorm: string) => void;
}

const STORAGE_KEYS = {
  selectedDorm: "campus_exchange.selected_dorm",
};

export const DORM_OPTIONS = [
  "Общежитие №1",
  "Общежитие №2",
  "Общежитие №3",
  "Общежитие №4",
  "Корпус А",
  "Корпус Б",
];

const InteractionStoreContext = createContext<InteractionStoreContextValue | null>(null);

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function InteractionStoreProvider({ children }: { children: ReactNode }) {
  const [selectedDorm, setSelectedDorm] = useState<string>(() => safeRead(STORAGE_KEYS.selectedDorm, "Все общежития"));

  useEffect(() => {
    safeWrite(STORAGE_KEYS.selectedDorm, selectedDorm);
  }, [selectedDorm]);

  const value = useMemo<InteractionStoreContextValue>(() => ({
    selectedDorm,
    setSelectedDorm,
  }), [selectedDorm]);

  return <InteractionStoreContext.Provider value={value}>{children}</InteractionStoreContext.Provider>;
}

export function useInteractionStore(): InteractionStoreContextValue {
  const context = useContext(InteractionStoreContext);

  if (!context) {
    throw new Error("useInteractionStore must be used within InteractionStoreProvider");
  }

  return context;
}
