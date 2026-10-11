import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Restaurant, MenuItem } from "../types/domain";

export interface AssistantQuery {
  maxBudget?: number;
  vegOnly?: boolean;
  cuisineKeywords: string[];
  wantsSpicy?: boolean;
  wantsHighRated?: boolean;
}

export interface AssistantResult {
  message: string;
  restaurants: Restaurant[];
  items: MenuItem[];
}

const CUISINE_KEYWORDS = ["biryani", "pizza", "burger", "chinese", "south indian", "north indian", "dessert", "healthy", "street food", "beverage"];

export function interpretPrompt(prompt: string): AssistantQuery {
  const text = prompt.toLowerCase();
  const budgetMatch = text.match(/under\s*₹?\s*(\d+)/) ?? text.match(/below\s*₹?\s*(\d+)/);
  return {
    maxBudget: budgetMatch ? Number(budgetMatch[1]) : undefined,
    vegOnly: /vegetarian|veg\b|jain/.test(text),
    cuisineKeywords: CUISINE_KEYWORDS.filter((k) => text.includes(k)),
    wantsSpicy: /spicy/.test(text),
    wantsHighRated: /highly rated|best|top rated/.test(text),
  };
}

export function runAssistantQuery(query: AssistantQuery): AssistantResult {
  let items: MenuItem[] = SEED_MENU_ITEMS.filter((i) => i.isAvailable);
  if (query.maxBudget) items = items.filter((i) => i.basePrice <= query.maxBudget!);
  if (query.vegOnly) items = items.filter((i) => i.vegFlag === "veg");
  if (query.cuisineKeywords.length) {
    const restaurantIds = new Set(
      SEED_RESTAURANTS.filter((r) => r.cuisines.some((c) => query.cuisineKeywords.some((k) => c.toLowerCase().includes(k)))).map((r) => r.id)
    );
    items = items.filter((i) => restaurantIds.has(i.restaurantId));
  }
  if (query.wantsSpicy) items = items.filter((i) => i.supportsSpiceLevel);

  let restaurants = SEED_RESTAURANTS.filter((r) => items.some((i) => i.restaurantId === r.id));
  if (query.wantsHighRated) restaurants = [...restaurants].sort((a, b) => b.rating - a.rating);

  const topItems = items.slice(0, 6);
  const topRestaurants = restaurants.slice(0, 4);

  const message = topItems.length
    ? `Here's what matches, based on real menu data: ${topItems.length} dish${topItems.length > 1 ? "es" : ""} across ${topRestaurants.length} restaurant${topRestaurants.length > 1 ? "s" : ""}.`
    : "I couldn't find a match in the current menu. Try loosening your budget or dietary filter.";

  return { message, restaurants: topRestaurants, items: topItems };
}
