import { SEED_COUPONS } from "../data/seed/offers";
import { Coupon } from "../types/domain";

export type CouponValidationResult = { ok: true; coupon: Coupon } | { ok: false; reason: string };

export async function validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<CouponValidationResult> {
  const coupon = SEED_COUPONS.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (!coupon) return { ok: false, reason: "Invalid coupon code" };
  if (new Date(coupon.expiresAt).getTime() < Date.now()) return { ok: false, reason: "This coupon has expired" };
  if (coupon.restaurantId && coupon.restaurantId !== restaurantId) return { ok: false, reason: "This coupon isn't valid at this restaurant" };
  if (subtotal < coupon.minOrderAmount) return { ok: false, reason: `Add items worth ₹${coupon.minOrderAmount - subtotal} more to use this coupon` };
  return { ok: true, coupon };
}
