import { filterRestaurants } from "../features/search/filters";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";

describe("filterRestaurants", () => {
  it("filters by cuisine", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { cuisine: "Chinese" });
    expect(result.every((r) => r.cuisines.includes("Chinese"))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by minimum rating", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { minRating: 4.5 });
    expect(result.every((r) => r.rating >= 4.5)).toBe(true);
  });

  it("filters by max price range", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { maxPriceRange: 1 });
    expect(result.every((r) => r.priceRange === 1)).toBe(true);
  });

  it("filters by max delivery time", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { maxEtaMinutes: 30 });
    expect(result.every((r) => r.etaMinutes <= 30)).toBe(true);
  });

  it("sorts by rating descending when requested", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { sortBy: "rating" });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].rating).toBeGreaterThanOrEqual(result[i].rating);
    }
  });

  it("returns all restaurants when no filters are applied", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, {});
    expect(result.length).toBe(SEED_RESTAURANTS.length);
  });
});
