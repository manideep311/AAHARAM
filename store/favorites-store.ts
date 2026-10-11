import { create } from "zustand";
import { getFavoriteRestaurantIds, getFavoriteMenuItemIds, toggleFavoriteRestaurant, toggleFavoriteMenuItem } from "../services/favorites";

interface FavoritesState {
  restaurantIds: string[];
  menuItemIds: string[];
  loaded: boolean;
  load: () => Promise<void>;
  toggleRestaurant: (id: string) => Promise<void>;
  toggleMenuItem: (id: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  restaurantIds: [],
  menuItemIds: [],
  loaded: false,
  load: async () => {
    const [restaurantIds, menuItemIds] = await Promise.all([getFavoriteRestaurantIds(), getFavoriteMenuItemIds()]);
    set({ restaurantIds, menuItemIds, loaded: true });
  },
  toggleRestaurant: async (id) => {
    await toggleFavoriteRestaurant(id);
    const restaurantIds = get().restaurantIds.includes(id) ? get().restaurantIds.filter((x) => x !== id) : [...get().restaurantIds, id];
    set({ restaurantIds });
  },
  toggleMenuItem: async (id) => {
    await toggleFavoriteMenuItem(id);
    const menuItemIds = get().menuItemIds.includes(id) ? get().menuItemIds.filter((x) => x !== id) : [...get().menuItemIds, id];
    set({ menuItemIds });
  },
}));
