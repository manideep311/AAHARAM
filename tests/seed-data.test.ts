import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_CATEGORIES } from "../data/seed/categories";

describe("seed data", () => {
  it("has at least 12 restaurants", () => {
    expect(SEED_RESTAURANTS.length).toBeGreaterThanOrEqual(12);
  });

  it("has at least 50 menu items", () => {
    expect(SEED_MENU_ITEMS.length).toBeGreaterThanOrEqual(50);
  });

  it("every menu item references an existing restaurant and category", () => {
    const restaurantIds = new Set(SEED_RESTAURANTS.map((r) => r.id));
    const categoryIds = new Set(SEED_CATEGORIES.map((c) => c.id));
    for (const item of SEED_MENU_ITEMS) {
      expect(restaurantIds.has(item.restaurantId)).toBe(true);
      expect(categoryIds.has(item.categoryId)).toBe(true);
    }
  });

  it("every restaurant has at least one menu item", () => {
    const covered = new Set(SEED_MENU_ITEMS.map((i) => i.restaurantId));
    for (const r of SEED_RESTAURANTS) {
      expect(covered.has(r.id)).toBe(true);
    }
  });

  it("includes both veg and non-veg items", () => {
    const flags = new Set(SEED_MENU_ITEMS.map((i) => i.vegFlag));
    expect(flags.has("veg")).toBe(true);
    expect(flags.has("non-veg")).toBe(true);
  });
});
