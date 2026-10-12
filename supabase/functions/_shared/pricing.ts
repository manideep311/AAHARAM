import type { CartCustomization, CartLineItem, Coupon, MenuItem, Restaurant } from "./domain.ts";

const TAX_RATE = 0.05;

export function calculateLineItemPrice(item: MenuItem, customization: CartCustomization): number {
  let price = item.basePrice;

  for (const group of item.optionGroups) {
    const selectedOptionId = customization.optionSelections[group.id];
    const option = group.options.find((o) => o.id === selectedOptionId);
    if (option) price += option.priceDelta;
  }

  for (const addOnId of customization.addOnIds) {
    const addOn = item.addOns.find((a) => a.id === addOnId);
    if (addOn) price += addOn.priceDelta;
  }

  return price;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  freeDelivery: boolean;
}

export function calculateCartTotals(
  lines: CartLineItem[],
  menuItems: MenuItem[],
  restaurant: Restaurant,
  coupon: Coupon | null
): CartTotals {
  const subtotal = lines.reduce((sum, line) => {
    const item = menuItems.find((m) => m.id === line.menuItemId);
    if (!item) return sum;
    return sum + calculateLineItemPrice(item, line.customization) * line.quantity;
  }, 0);

  let discount = 0;
  let freeDelivery = false;

  if (coupon && subtotal >= coupon.minOrderAmount) {
    if (coupon.type === "percentage") {
      discount = Math.round((subtotal * coupon.value) / 100);
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === "fixed") {
      discount = Math.min(coupon.value, subtotal);
    } else if (coupon.type === "free-delivery") {
      freeDelivery = true;
    }
  }

  const deliveryFee = freeDelivery ? 0 : restaurant.deliveryFee;
  const tax = Math.round((subtotal - discount) * TAX_RATE);
  const total = subtotal - discount + deliveryFee + tax;

  return { subtotal, discount, deliveryFee, tax, total, freeDelivery };
}
