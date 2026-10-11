import { calculateLineItemPrice, calculateCartTotals } from "../lib/pricing/calculate";
import { formatCurrency } from "../lib/formatting/currency";
import { SEED_MENU_ITEMS, } from "../data/seed/menu-items";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_COUPONS } from "../data/seed/offers";
import { CartLineItem } from "../types/domain";

const paneerBiryani = SEED_MENU_ITEMS.find((i) => i.id === "m1")!;
const restaurant = SEED_RESTAURANTS.find((r) => r.id === "r1")!;

describe("calculateLineItemPrice", () => {
  it("adds option price deltas", () => {
    const price = calculateLineItemPrice(paneerBiryani, {
      optionSelections: { og1: "opt2" }, // Large +60
      addOnIds: [],
    });
    expect(price).toBe(280); // 220 + 60
  });

  it("adds add-on price deltas", () => {
    const price = calculateLineItemPrice(paneerBiryani, {
      optionSelections: { og1: "opt1" },
      addOnIds: ["a1", "a2"], // +40 +25
    });
    expect(price).toBe(285); // 220 + 0 + 40 + 25
  });
});

describe("calculateCartTotals", () => {
  const lines: CartLineItem[] = [
    {
      lineId: "l1",
      menuItemId: "m1",
      restaurantId: "r1",
      quantity: 2,
      customization: { optionSelections: { og1: "opt1" }, addOnIds: [] },
      unitPrice: 220,
    },
  ];

  it("computes subtotal, delivery fee, tax, and total with no coupon", () => {
    const totals = calculateCartTotals(lines, SEED_MENU_ITEMS, restaurant, null);
    expect(totals.subtotal).toBe(440);
    expect(totals.deliveryFee).toBe(29);
    expect(totals.discount).toBe(0);
    expect(totals.tax).toBe(Math.round(440 * 0.05));
    expect(totals.total).toBe(totals.subtotal - totals.discount + totals.deliveryFee + totals.tax);
  });

  it("applies a percentage coupon capped at maxDiscount", () => {
    const coupon = SEED_COUPONS.find((c) => c.code === "BIRYANI20")!;
    const totals = calculateCartTotals(lines, SEED_MENU_ITEMS, restaurant, coupon);
    expect(totals.discount).toBe(88); // 20% of 440 = 88, under max 100
  });

  it("applies free-delivery coupon by zeroing delivery fee", () => {
    const coupon = SEED_COUPONS.find((c) => c.code === "FIRSTFREE")!;
    const totals = calculateCartTotals(lines, SEED_MENU_ITEMS, restaurant, coupon);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.freeDelivery).toBe(true);
  });
});

describe("formatCurrency", () => {
  it("formats whole rupees with the ₹ symbol and no decimals", () => {
    expect(formatCurrency(220)).toBe("₹220");
    expect(formatCurrency(1299)).toBe("₹1,299");
  });
});
