import { supabase } from "../lib/supabase";

type FavoriteKind = "restaurant" | "menu_item";

async function readIds(kind: FavoriteKind): Promise<string[]> {
  const { data, error } = await supabase.from("favorites").select("target_id").eq("kind", kind);
  if (error) throw error;
  return data.map((row) => row.target_id as string);
}

async function setFavorite(kind: FavoriteKind, targetId: string, favorite: boolean): Promise<void> {
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ kind, target_id: targetId }, { onConflict: "user_id,kind,target_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("kind", kind).eq("target_id", targetId);
  if (error) throw error;
}

export const getFavoriteRestaurantIds = () => readIds("restaurant");
export const getFavoriteMenuItemIds = () => readIds("menu_item");
export const setRestaurantFavorite = (id: string, favorite: boolean) => setFavorite("restaurant", id, favorite);
export const setMenuItemFavorite = (id: string, favorite: boolean) => setFavorite("menu_item", id, favorite);
