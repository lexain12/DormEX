import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { type Task } from "@/lib/data";

type InteractionType = "service-offer" | "price-offer" | "message";
type NotificationType = InteractionType | "request-created" | "system";

export interface TaskInteraction {
  id: string;
  taskId: string;
  taskTitle: string;
  type: InteractionType;
  content: string;
  amount?: number;
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  taskId?: string;
  createdAt: number;
  read: boolean;
}

interface InteractionStoreContextValue {
  selectedDorm: string;
  setSelectedDorm: (dorm: string) => void;
  localTasks: Task[];
  addLocalTask: (task: Task) => void;
  taskInteractions: TaskInteraction[];
  addTaskInteraction: (interaction: Omit<TaskInteraction, "id" | "createdAt">) => TaskInteraction;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  addNotification: (notification: Omit<NotificationItem, "id" | "createdAt" | "read">) => NotificationItem;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
}

const STORAGE_KEYS = {
  selectedDorm: "campus_exchange.selected_dorm",
  localTasks: "campus_exchange.local_tasks",
  interactions: "campus_exchange.task_interactions",
  notifications: "campus_exchange.notifications",
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

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function InteractionStoreProvider({ children }: { children: ReactNode }) {
  const [selectedDorm, setSelectedDorm] = useState<string>(() => safeRead(STORAGE_KEYS.selectedDorm, "Общежитие №4"));
  const [localTasks, setLocalTasks] = useState<Task[]>(() => safeRead(STORAGE_KEYS.localTasks, []));
  const [taskInteractions, setTaskInteractions] = useState<TaskInteraction[]>(() => safeRead(STORAGE_KEYS.interactions, []));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => safeRead(STORAGE_KEYS.notifications, []));

  useEffect(() => {
    safeWrite(STORAGE_KEYS.selectedDorm, selectedDorm);
  }, [selectedDorm]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.localTasks, localTasks);
  }, [localTasks]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.interactions, taskInteractions);
  }, [taskInteractions]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.notifications, notifications);
  }, [notifications]);

  const unreadNotificationsCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

  const value = useMemo<InteractionStoreContextValue>(() => ({
    selectedDorm,
    setSelectedDorm,
    localTasks,
    addLocalTask: (task: Task) => {
      setLocalTasks((prev) => [task, ...prev]);
    },
    taskInteractions,
    addTaskInteraction: (interaction) => {
      const nextInteraction: TaskInteraction = {
        ...interaction,
        id: makeId("interaction"),
        createdAt: Date.now(),
      };

      setTaskInteractions((prev) => [nextInteraction, ...prev]);
      return nextInteraction;
    },
    notifications,
    unreadNotificationsCount,
    addNotification: (notification) => {
      const nextNotification: NotificationItem = {
        ...notification,
        id: makeId("notification"),
        createdAt: Date.now(),
        read: false,
      };

      setNotifications((prev) => [nextNotification, ...prev]);
      return nextNotification;
    },
    markNotificationRead: (notificationId) => {
      setNotifications((prev) => prev.map((notification) => (
        notification.id === notificationId ? { ...notification, read: true } : notification
      )));
    },
    markAllNotificationsRead: () => {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    },
    clearNotifications: () => {
      setNotifications([]);
    },
  }), [localTasks, notifications, selectedDorm, taskInteractions, unreadNotificationsCount]);

  return <InteractionStoreContext.Provider value={value}>{children}</InteractionStoreContext.Provider>;
}

export function useInteractionStore(): InteractionStoreContextValue {
  const context = useContext(InteractionStoreContext);

  if (!context) {
    throw new Error("useInteractionStore must be used within InteractionStoreProvider");
  }

  return context;
}
