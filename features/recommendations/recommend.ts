import { Order, Restaurant } from "../../types/domain";
import { Preferences } from "../../store/preferences-store";

export interface RecommendationGroup {
  reason: string;
  restaurants: Restaurant[];
}

export function getRecommendations(input: {
  orders: Order[];
  favoriteRestaurantIds: string[];
  preferences: Preferences;
  restaurants: Restaurant[];
}): RecommendationGroup[] {
  const groups: RecommendationGroup[] = [];

  const orderedRestaurantIds = [...new Set(input.orders.map((o) => o.restaurantId))];
  if (orderedRestaurantIds.length > 0) {
    const restaurants = input.restaurants.filter((r) => orderedRestaurantIds.includes(r.id));
    if (restaurants.length) groups.push({ reason: "Order Again", restaurants });
  }

  if (input.favoriteRestaurantIds.length > 0) {
    const restaurants = input.restaurants.filter(
      (r) => !input.favoriteRestaurantIds.includes(r.id) && r.cuisines.some((c) => input.restaurants.find((f) => input.favoriteRestaurantIds.includes(f.id))?.cuisines.includes(c))
    );
    if (restaurants.length) groups.push({ reason: "Based on Your Favorites", restaurants });
  }

  if (input.preferences.budgetPerMeal) {
    const restaurants = input.restaurants.filter((r) => {
      const maxForRange = { 1: 200, 2: 400, 3: 1000 }[r.priceRange];
      return input.preferences.budgetPerMeal! <= maxForRange;
    });
    if (restaurants.length) groups.push({ reason: `Recommended for Your Budget (under ₹${input.preferences.budgetPerMeal})`, restaurants });
  }

  if (groups.length === 0) {
    groups.push({ reason: "Popular Right Now", restaurants: [...input.restaurants].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 6) });
  }

  return groups;
}
