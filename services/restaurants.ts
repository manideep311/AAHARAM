import { supabase } from "../lib/supabase";
import { MenuCategory, MenuItem, Restaurant } from "../types/domain";
import { menuCategoryFromRow, menuItemFromRow, restaurantFromRow } from "../supabase/functions/_shared/mappers";

export async function getRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.from("restaurants").select("*").order("rating_count", { ascending: false });
  if (error) throw error;
  return data.map(restaurantFromRow);
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? restaurantFromRow(data) : null;
}

export async function getMenuForRestaurant(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  const [categoriesRes, itemsRes] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("name"),
  ]);
  if (categoriesRes.error) throw categoriesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  return { categories: categoriesRes.data.map(menuCategoryFromRow), items: itemsRes.data.map(menuItemFromRow) };
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  const { data, error } = await supabase.from("menu_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? menuItemFromRow(data) : null;
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("rating", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data.map(menuItemFromRow);
}
