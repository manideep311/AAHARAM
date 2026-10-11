import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Restaurant, MenuItem } from "../types/domain";

export async function searchAll(query: string): Promise<{ restaurants: Restaurant[]; items: MenuItem[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return { restaurants: [], items: [] };

  const restaurants = SEED_RESTAURANTS.filter(
    (r) => r.name.toLowerCase().includes(q) || r.cuisines.some((c) => c.toLowerCase().includes(q))
  );
  // Defense-in-depth: createOrder's isOpen check is the authoritative guard against ordering from
  // a closed restaurant, but there's no reason to let a closed restaurant's dishes surface here as
  // addable results in the first place.
  const openRestaurantIds = new Set(SEED_RESTAURANTS.filter((r) => r.isOpen).map((r) => r.id));
  const items = SEED_MENU_ITEMS.filter(
    (i) =>
      (i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)) &&
      openRestaurantIds.has(i.restaurantId)
  );

  return { restaurants, items };
}
