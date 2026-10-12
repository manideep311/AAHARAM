import { supabase } from "../lib/supabase";
import { MenuItem, Restaurant } from "../types/domain";
import { menuItemFromRow, MenuItemRow, restaurantFromRow, RestaurantRow } from "../supabase/functions/_shared/mappers";

// search_catalog (SQL) excludes dishes from closed restaurants, matching the defense-in-depth
// rule from Sub-project 1: place-order's isOpen check is authoritative, but closed
// restaurants' dishes shouldn't surface as addable results in the first place.
export async function searchAll(query: string): Promise<{ restaurants: Restaurant[]; items: MenuItem[] }> {
  const q = query.trim();
  if (!q) return { restaurants: [], items: [] };
  const { data, error } = await supabase.rpc("search_catalog", { q });
  if (error) throw error;
  const result = data as { restaurants: RestaurantRow[]; items: MenuItemRow[] };
  return { restaurants: result.restaurants.map(restaurantFromRow), items: result.items.map(menuItemFromRow) };
}
