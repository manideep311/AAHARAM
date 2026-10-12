import { supabase } from "../lib/supabase";
import { checkCoupon } from "../supabase/functions/_shared/coupons";
import { couponFromRow } from "../supabase/functions/_shared/mappers";
import { Coupon } from "../types/domain";

export type CouponValidationResult = { ok: true; coupon: Coupon } | { ok: false; reason: string };

// Cart/checkout preview only. place-order re-runs the same checkCoupon rules before charging.
export async function validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<CouponValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "Enter a coupon code" };
  const { data, error } = await supabase.from("coupons").select("*").eq("code", normalized).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, reason: "Invalid coupon code" };
  const coupon = couponFromRow(data);
  const check = checkCoupon(coupon, subtotal, restaurantId, new Date());
  return check.ok ? { ok: true, coupon } : check;
}
