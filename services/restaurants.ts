import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_CATEGORIES } from "../data/seed/categories";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Restaurant, MenuCategory, MenuItem } from "../types/domain";

const SIMULATED_LATENCY_MS = 250;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), SIMULATED_LATENCY_MS));
}

export async function getRestaurants(): Promise<Restaurant[]> {
  return delay(SEED_RESTAURANTS);
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  return delay(SEED_RESTAURANTS.find((r) => r.id === id) ?? null);
}

export async function getMenuForRestaurant(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  return delay({
    categories: SEED_CATEGORIES.filter((c) => c.restaurantId === restaurantId).sort((a, b) => a.sortOrder - b.sortOrder),
    items: SEED_MENU_ITEMS.filter((i) => i.restaurantId === restaurantId),
  });
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  return delay(SEED_MENU_ITEMS.find((m) => m.id === id) ?? null);
}
