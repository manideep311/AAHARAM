import { create } from "zustand";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  push: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  push: (notification) => {
    const item: AppNotification = { ...notification, id: `n${Date.now()}`, createdAt: new Date().toISOString(), read: false };
    set({ items: [item, ...get().items], unreadCount: get().unreadCount + 1 });
  },
  markAllRead: () => set({ items: get().items.map((i) => ({ ...i, read: true })), unreadCount: 0 }),
}));
