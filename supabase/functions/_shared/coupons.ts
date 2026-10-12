import type { Coupon } from "./domain.ts";

export type CouponCheck = { ok: true } | { ok: false; reason: string };

// Coupon eligibility rules, shared by the cart preview (services/coupons.ts) and the
// authoritative re-check inside the place-order Edge Function. `now` is injected so the
// rules are deterministic in tests and identical on both sides.
export function checkCoupon(coupon: Coupon, subtotal: number, restaurantId: string, now: Date): CouponCheck {
  if (new Date(coupon.expiresAt).getTime() < now.getTime()) {
    return { ok: false, reason: "This coupon has expired" };
  }
  if (coupon.restaurantId && coupon.restaurantId !== restaurantId) {
    return { ok: false, reason: "This coupon isn't valid at this restaurant" };
  }
  if (subtotal < coupon.minOrderAmount) {
    return { ok: false, reason: `Add items worth ₹${coupon.minOrderAmount - subtotal} more to use this coupon` };
  }
  return { ok: true };
}
