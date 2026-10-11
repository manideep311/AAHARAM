import { Offer, Coupon } from "../../types/domain";

export const SEED_OFFERS: Offer[] = [
  { id: "o1", restaurantId: "r1", title: "20% OFF", description: "Up to ₹100 off on orders above ₹299", couponCode: "BIRYANI20" },
  { id: "o2", title: "Free Delivery", description: "On your first order", couponCode: "FIRSTFREE" },
  { id: "o3", restaurantId: "r3", title: "15% OFF", description: "15% off up to ₹75 on orders above ₹249", couponCode: "PIZZA15" },
  { id: "o4", title: "Flat ₹50 Off", description: "On orders above ₹199", couponCode: "FLAT50" },
  { id: "o5", restaurantId: "r9", title: "₹75 OFF", description: "Flat ₹75 off on healthy bowls above ₹349", couponCode: "HEALTHY30" },
  { id: "o6", restaurantId: "r12", title: "10% OFF (Expired)", description: "Limited-time offer that has now expired", couponCode: "EXPIRED10" },
];

export const SEED_COUPONS: Coupon[] = [
  { code: "BIRYANI20", description: "20% off up to ₹100", type: "percentage", value: 20, minOrderAmount: 299, maxDiscount: 100, restaurantId: "r1", expiresAt: "2026-12-31" },
  { code: "FIRSTFREE", description: "Free delivery on first order", type: "free-delivery", value: 0, minOrderAmount: 0, expiresAt: "2026-12-31" },
  { code: "FLAT50", description: "Flat ₹50 off orders above ₹199", type: "fixed", value: 50, minOrderAmount: 199, expiresAt: "2026-11-30" },
  { code: "EXPIRED10", description: "Expired test coupon", type: "percentage", value: 10, minOrderAmount: 0, expiresAt: "2025-01-01" },
  { code: "PIZZA15", description: "15% off up to ₹75 on pizzas", type: "percentage", value: 15, minOrderAmount: 249, maxDiscount: 75, restaurantId: "r3", expiresAt: "2026-12-31" },
  { code: "HEALTHY30", description: "Flat ₹75 off on healthy bowls", type: "fixed", value: 75, minOrderAmount: 349, restaurantId: "r9", expiresAt: "2026-12-31" },
];
