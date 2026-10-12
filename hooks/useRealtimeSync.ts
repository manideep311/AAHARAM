import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";

// One Realtime channel per signed-in user. Row changes don't carry everything the screens
// need, so events simply invalidate the matching queries and TanStack Query refetches.
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userId = user && !user.isGuest ? user.id : null;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        const id = (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id;
        if (id) queryClient.invalidateQueries({ queryKey: ["order", id] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
