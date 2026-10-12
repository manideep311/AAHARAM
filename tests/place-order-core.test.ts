import {
  validateAndPriceOrder, isCancellable, PlaceOrderInput, PlaceOrderCatalog,
} from "../supabase/functions/_shared/place-order-core";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_COUPONS } from "../data/seed/offers";
import { Address } from "../types/domain";

const NOW = new Date("2026-10-12T12:00:00Z");
const USER = "6f1c1d1e-0000-4000-8000-0000000000aa";

const r1 = SEED_RESTAURANTS.find((r) => r.id === "r1")!; // open, deliveryFee 29, min 99, eta 35
const r11 = SEED_RESTAURANTS.find((r) => r.id === "r11")!; // closed
const m1 = SEED_MENU_ITEMS.find((i) => i.id === "m1")!; // Paneer Biryani 220, og1 required (opt1 +0, opt2 +60), a1 +40, a2 +25
const m2 = SEED_MENU_ITEMS.find((i) => i.id === "m2")!;
const m17 = SEED_MENU_ITEMS.find((i) => i.id === "m17")!; // r4, isAvailable false
const m45 = SEED_MENU_ITEMS.find((i) => i.id === "m45")!; // r11
const otherRestaurantItem = SEED_MENU_ITEMS.find((i) => i.restaurantId === "r2" && i.isAvailable)!;
const BIRYANI20 = SEED_COUPONS.find((c) => c.code === "BIRYANI20")!;
const PIZZA15 = SEED_COUPONS.find((c) => c.code === "PIZZA15")!;

const address: Address = {
  id: "6f1c1d1e-0000-4000-8000-000000000001",
  label: "Home",
  recipientName: "Asha Rao",
  phone: "9876543210",
  line1: "12 MG Road",
  area: "Indiranagar",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560038",
  isDefault: true,
};

function input(overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    clientRequestId: "req-1700000000000-abc123",
    restaurantId: "r1",
    lines: [{ menuItemId: "m1", quantity: 2, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
    couponCode: null,
    addressId: address.id,
    paymentMethod: "upi",
    deliveryInstructions: null,
    expectedTotal: 491, // 440 subtotal + 29 delivery + 22 tax
    ...overrides,
  };
}

function catalog(overrides: Partial<PlaceOrderCatalog> = {}): PlaceOrderCatalog {
  return { restaurant: r1, menuItems: [m1, m2], coupon: null, address, ...overrides };
}

function expectError(result: ReturnType<typeof validateAndPriceOrder>, code: string) {
  if (result.ok) throw new Error(`expected ${code}, got ok`);
  expect(result.error.code).toBe(code);
  return result.error;
}

describe("validateAndPriceOrder — success", () => {
  it("builds the order row with server-computed totals", () => {
    const result = validateAndPriceOrder(input(), catalog(), USER, NOW);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row).toEqual({
      user_id: USER,
      client_request_id: "req-1700000000000-abc123",
      restaurant_id: "r1",
      restaurant_name: "Biryani Junction",
      items: [{ menuItemId: "m1", name: "Paneer Biryani", quantity: 2, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
      address,
      delivery_instructions: null,
      payment_method: "upi",
      payment_status: "paid_simulated",
      status: "placed",
      subtotal: 440,
      discount: 0,
      delivery_fee: 29,
      tax: 22,
      total: 491,
      coupon_code: null,
      eta_minutes: 35,
    });
  });

  it("marks cash-on-delivery orders as pending_cod", () => {
    const result = validateAndPriceOrder(input({ paymentMethod: "cod" }), catalog(), USER, NOW);
    expect(result.ok && result.row.payment_status).toBe("pending_cod");
  });

  it("prices options and add-ons on the server", () => {
    const result = validateAndPriceOrder(
      input({
        lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "opt2" }, addOnIds: ["a1"] } }],
        expectedTotal: 365, // 320 + 29 + 16
      }),
      catalog(),
      USER,
      NOW
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row.items[0].unitPrice).toBe(320);
    expect(result.row.total).toBe(365);
  });

  it("applies a valid coupon", () => {
    const result = validateAndPriceOrder(
      input({ couponCode: "BIRYANI20", expectedTotal: 399 }), // 440 - 88 + 29 + 18
      catalog({ coupon: BIRYANI20 }),
      USER,
      NOW
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row.discount).toBe(88);
    expect(result.row.coupon_code).toBe("BIRYANI20");
    expect(result.row.total).toBe(399);
  });

  it("trims delivery instructions and stores blank ones as null", () => {
    const withNote = validateAndPriceOrder(input({ deliveryInstructions: "  Leave at door  " }), catalog(), USER, NOW);
    const blank = validateAndPriceOrder(input({ deliveryInstructions: "   " }), catalog(), USER, NOW);
    expect(withNote.ok && withNote.row.delivery_instructions).toBe("Leave at door");
    expect(blank.ok && blank.row.delivery_instructions).toBeNull();
  });
});

describe("validateAndPriceOrder — rejections", () => {
  it("NOT_FOUND when the restaurant is missing", () => {
    expectError(validateAndPriceOrder(input(), catalog({ restaurant: null }), USER, NOW), "NOT_FOUND");
  });

  it("RESTAURANT_CLOSED when the restaurant is closed", () => {
    const result = validateAndPriceOrder(
      input({ restaurantId: "r11", lines: [{ menuItemId: "m45", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } }] }),
      catalog({ restaurant: r11, menuItems: [m45] }),
      USER,
      NOW
    );
    expectError(result, "RESTAURANT_CLOSED");
  });

  it("NOT_FOUND when the address is missing or not the caller's", () => {
    const error = expectError(validateAndPriceOrder(input(), catalog({ address: null }), USER, NOW), "NOT_FOUND");
    expect(error.message).toBe("Delivery address not found");
  });

  it("INVALID_INPUT for an empty cart", () => {
    expectError(validateAndPriceOrder(input({ lines: [] }), catalog(), USER, NOW), "INVALID_INPUT");
  });

  it("ITEM_UNAVAILABLE lists unavailable, foreign and unknown items", () => {
    const result = validateAndPriceOrder(
      input({
        lines: [
          { menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } },
          { menuItemId: "m17", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } },
          { menuItemId: otherRestaurantItem.id, quantity: 1, customization: { optionSelections: {}, addOnIds: [] } },
          { menuItemId: "does-not-exist", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } },
        ],
      }),
      catalog({ menuItems: [m1, m17, otherRestaurantItem] }),
      USER,
      NOW
    );
    const error = expectError(result, "ITEM_UNAVAILABLE");
    expect(error.details).toEqual({ menuItemIds: ["m17", otherRestaurantItem.id, "does-not-exist"] });
  });

  it("INVALID_INPUT when a required option group has no selection", () => {
    const error = expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
    expect(error.message).toBe("Choose a size for Paneer Biryani");
  });

  it("INVALID_INPUT for an unknown option id", () => {
    expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "nope" }, addOnIds: [] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
  });

  it("INVALID_INPUT for an unknown add-on id", () => {
    expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "opt1" }, addOnIds: ["zzz"] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
  });

  it("INVALID_INPUT for a non-positive quantity", () => {
    expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 0, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
  });

  it("COUPON_INVALID for an unknown code", () => {
    const error = expectError(validateAndPriceOrder(input({ couponCode: "NOTREAL" }), catalog({ coupon: null }), USER, NOW), "COUPON_INVALID");
    expect(error.details).toEqual({ reason: "Invalid coupon code" });
  });

  it("COUPON_INVALID for a coupon from another restaurant", () => {
    const error = expectError(validateAndPriceOrder(input({ couponCode: "PIZZA15" }), catalog({ coupon: PIZZA15 }), USER, NOW), "COUPON_INVALID");
    expect(error.details).toEqual({ reason: "This coupon isn't valid at this restaurant" });
  });

  it("BELOW_MIN_ORDER reports the shortfall", () => {
    const error = expectError(
      validateAndPriceOrder(input(), catalog({ restaurant: { ...r1, minOrderAmount: 1000 } }), USER, NOW),
      "BELOW_MIN_ORDER"
    );
    expect(error.details).toEqual({ shortfall: 560 });
  });

  it("PRICE_CHANGED returns the server totals when expectedTotal differs", () => {
    const error = expectError(validateAndPriceOrder(input({ expectedTotal: 400 }), catalog(), USER, NOW), "PRICE_CHANGED");
    expect((error.details as { totals: { total: number } }).totals.total).toBe(491);
  });
});

describe("isCancellable", () => {
  it("allows cancelling only placed and confirmed orders", () => {
    expect(isCancellable("placed")).toBe(true);
    expect(isCancellable("confirmed")).toBe(true);
    expect(isCancellable("preparing")).toBe(false);
    expect(isCancellable("delivered")).toBe(false);
    expect(isCancellable("cancelled")).toBe(false);
  });
});
