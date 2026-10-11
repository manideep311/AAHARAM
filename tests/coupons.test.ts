import { validateCoupon } from "../services/coupons";

describe("validateCoupon", () => {
  it("rejects an unknown code", async () => {
    const result = await validateCoupon("NOTREAL", 500, "r1");
    expect(result.ok).toBe(false);
  });

  it("rejects when subtotal is below minOrderAmount", async () => {
    const result = await validateCoupon("BIRYANI20", 100, "r1");
    expect(result.ok).toBe(false);
  });

  it("rejects an expired coupon", async () => {
    const result = await validateCoupon("EXPIRED10", 500, "r1");
    expect(result.ok).toBe(false);
  });

  it("rejects a restaurant-specific coupon used at a different restaurant", async () => {
    const result = await validateCoupon("BIRYANI20", 500, "r2");
    expect(result.ok).toBe(false);
  });

  it("accepts a valid matching coupon", async () => {
    const result = await validateCoupon("BIRYANI20", 500, "r1");
    expect(result.ok).toBe(true);
  });
});
