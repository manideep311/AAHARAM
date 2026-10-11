import { buildReorderCart } from "../features/orders/reorder";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Order } from "../types/domain";

const restaurant = SEED_RESTAURANTS.find((r) => r.id === "r1")!;
const currentMenu = SEED_MENU_ITEMS.filter((i) => i.restaurantId === "r1");

const sampleOrder: Order = {
  id: "ord1", restaurantId: "r1", restaurantName: restaurant.name,
  items: [{ menuItemId: "m1", name: "Paneer Biryani", quantity: 1, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
  status: "delivered", placedAt: "2026-09-01T00:00:00.000Z", addressId: "addr1", paymentMethod: "upi",
  subtotal: 220, discount: 0, deliveryFee: 29, tax: 11, total: 260,
};

describe("buildReorderCart", () => {
  it("rebuilds a line for each still-available item at current price", () => {
    const result = buildReorderCart(sampleOrder, restaurant, currentMenu);
    expect(result.restaurantUnavailable).toBe(false);
    expect(result.addableLines.length).toBe(1);
    expect(result.addableLines[0].unitPrice).toBe(220); // current base price, not a stale number
    expect(result.unavailableItems.length).toBe(0);
  });

  it("flags items that no longer exist on the menu", () => {
    const vanishedOrder: Order = { ...sampleOrder, items: [{ ...sampleOrder.items[0], menuItemId: "does-not-exist" }] };
    const result = buildReorderCart(vanishedOrder, restaurant, currentMenu);
    expect(result.addableLines.length).toBe(0);
    expect(result.unavailableItems.length).toBe(1);
    expect(result.unavailableItems[0].reason).toMatch(/no longer available/i);
  });

  it("flags items that are currently marked unavailable", () => {
    const menuWithUnavailable = currentMenu.map((i) => (i.id === "m1" ? { ...i, isAvailable: false } : i));
    const result = buildReorderCart(sampleOrder, restaurant, menuWithUnavailable);
    expect(result.unavailableItems.length).toBe(1);
  });

  it("flags restaurantUnavailable when the restaurant is null or closed", () => {
    const result = buildReorderCart(sampleOrder, null, currentMenu);
    expect(result.restaurantUnavailable).toBe(true);
    expect(result.addableLines.length).toBe(0);
  });
});
