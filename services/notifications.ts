import { supabase } from "../lib/supabase";
import { AppNotification } from "../types/domain";
import { notificationFromRow, type NotificationRow } from "../supabase/functions/_shared/mappers";

export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as NotificationRow[]).map(notificationFromRow);
}

/** Clients may only set read_at (column-level grant); RLS limits this to the caller's rows. */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
