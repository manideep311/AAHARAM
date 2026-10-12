import { checkCoupon } from "../supabase/functions/_shared/coupons";
import { Coupon } from "../types/domain";

const NOW = new Date("2026-10-12T12:00:00Z");

const base: Coupon = {
  code: "TEST20",
  description: "20% off up to ₹100",
  type: "percentage",
  value: 20,
  minOrderAmount: 299,
  maxDiscount: 100,
  restaurantId: "r1",
  expiresAt: "2026-12-31",
};

describe("checkCoupon", () => {
  it("accepts a valid coupon at its restaurant", () => {
    expect(checkCoupon(base, 500, "r1", NOW)).toEqual({ ok: true });
  });

  it("rejects an expired coupon", () => {
    expect(checkCoupon({ ...base, expiresAt: "2026-01-01" }, 500, "r1", NOW)).toEqual({
      ok: false,
      reason: "This coupon has expired",
    });
  });

  it("rejects a restaurant-specific coupon at another restaurant", () => {
    expect(checkCoupon(base, 500, "r2", NOW)).toEqual({
      ok: false,
      reason: "This coupon isn't valid at this restaurant",
    });
  });

  it("accepts a platform-wide coupon at any restaurant", () => {
    expect(checkCoupon({ ...base, restaurantId: undefined }, 500, "r7", NOW)).toEqual({ ok: true });
  });

  it("rejects when the subtotal is below the coupon minimum and states the shortfall", () => {
    expect(checkCoupon(base, 200, "r1", NOW)).toEqual({
      ok: false,
      reason: "Add items worth ₹99 more to use this coupon",
    });
  });
});
