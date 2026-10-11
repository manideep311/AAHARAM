import AsyncStorage from "@react-native-async-storage/async-storage";

const REST_KEY = "aaharam:favorites:restaurants";
const ITEM_KEY = "aaharam:favorites:items";

async function readIds(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function toggle(key: string, id: string): Promise<boolean> {
  const ids = await readIds(key);
  const isFavorited = ids.includes(id);
  const next = isFavorited ? ids.filter((x) => x !== id) : [...ids, id];
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return !isFavorited;
}

export const getFavoriteRestaurantIds = () => readIds(REST_KEY);
export const getFavoriteMenuItemIds = () => readIds(ITEM_KEY);
export const toggleFavoriteRestaurant = (id: string) => toggle(REST_KEY, id);
export const toggleFavoriteMenuItem = (id: string) => toggle(ITEM_KEY, id);
