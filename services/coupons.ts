import { SEED_COUPONS } from "../data/seed/offers";
import { checkCoupon } from "../supabase/functions/_shared/coupons";
import { Coupon } from "../types/domain";

export type CouponValidationResult = { ok: true; coupon: Coupon } | { ok: false; reason: string };

export async function validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<CouponValidationResult> {
  const coupon = SEED_COUPONS.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (!coupon) return { ok: false, reason: "Invalid coupon code" };
  const check = checkCoupon(coupon, subtotal, restaurantId, new Date());
  return check.ok ? { ok: true, coupon } : check;
}
