import { create } from "zustand";
import {
  getFavoriteRestaurantIds, getFavoriteMenuItemIds, setRestaurantFavorite, setMenuItemFavorite,
} from "../services/favorites";
import { useAuthStore } from "./auth-store";

interface FavoritesState {
  restaurantIds: string[];
  menuItemIds: string[];
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  toggleRestaurant: (id: string) => Promise<void>;
  toggleMenuItem: (id: string) => Promise<void>;
}

function signedIn(): boolean {
  const user = useAuthStore.getState().user;
  return !!user && !user.isGuest;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  restaurantIds: [],
  menuItemIds: [],
  loaded: false,

  load: async () => {
    if (!signedIn()) {
      set({ restaurantIds: [], menuItemIds: [], loaded: true });
      return;
    }
    try {
      const [restaurantIds, menuItemIds] = await Promise.all([getFavoriteRestaurantIds(), getFavoriteMenuItemIds()]);
      set({ restaurantIds, menuItemIds, loaded: true });
    } catch {
      set({ loaded: true }); // keep whatever we had; screens still render
    }
  },

  reset: () => set({ restaurantIds: [], menuItemIds: [], loaded: false }),

  // Optimistic: flip locally, then persist; roll back if the server rejects it.
  toggleRestaurant: async (id) => {
    const before = get().restaurantIds;
    const favorite = !before.includes(id);
    set({ restaurantIds: favorite ? [...before, id] : before.filter((x) => x !== id) });
    try {
      await setRestaurantFavorite(id, favorite);
    } catch {
      set({ restaurantIds: before });
    }
  },

  toggleMenuItem: async (id) => {
    const before = get().menuItemIds;
    const favorite = !before.includes(id);
    set({ menuItemIds: favorite ? [...before, id] : before.filter((x) => x !== id) });
    try {
      await setMenuItemFavorite(id, favorite);
    } catch {
      set({ menuItemIds: before });
    }
  },
}));
