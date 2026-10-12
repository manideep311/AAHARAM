import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead } from "../services/notifications";
import { useAuthStore } from "../store/auth-store";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const signedIn = !!user && !user.isGuest;
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["notifications"], queryFn: getNotifications, enabled: signedIn });
  const items = signedIn ? query.data ?? [] : [];
  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = useCallback(async () => {
    if (!signedIn || unreadCount === 0) return;
    await markAllNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [signedIn, unreadCount, queryClient]);

  return { items, unreadCount, markAllRead, isLoading: signedIn && query.isLoading, signedIn };
}
