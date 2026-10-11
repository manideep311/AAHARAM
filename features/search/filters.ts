import { Restaurant } from "../../types/domain";

export interface RestaurantFilters {
  cuisine?: string;
  minRating?: number;
  maxPriceRange?: 1 | 2 | 3;
  maxEtaMinutes?: number;
  vegOnly?: boolean; // reserved: menu-level veg filtering happens at item level (Task 11)
  sortBy?: "rating" | "price" | "eta" | "relevance";
}

export function filterRestaurants(restaurants: Restaurant[], filters: RestaurantFilters): Restaurant[] {
  let result = restaurants.filter((r) => {
    if (filters.cuisine && !r.cuisines.includes(filters.cuisine)) return false;
    if (filters.minRating && r.rating < filters.minRating) return false;
    if (filters.maxPriceRange && r.priceRange > filters.maxPriceRange) return false;
    if (filters.maxEtaMinutes && r.etaMinutes > filters.maxEtaMinutes) return false;
    return true;
  });

  if (filters.sortBy === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
  if (filters.sortBy === "price") result = [...result].sort((a, b) => a.priceRange - b.priceRange);
  if (filters.sortBy === "eta") result = [...result].sort((a, b) => a.etaMinutes - b.etaMinutes);

  return result;
}
