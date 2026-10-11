import { Order, Restaurant, MenuItem, CartLineItem } from "../../types/domain";
import { calculateLineItemPrice } from "../../lib/pricing/calculate";

export interface ReorderResult {
  addableLines: CartLineItem[];
  unavailableItems: { name: string; reason: string }[];
  restaurantUnavailable: boolean;
}

export function buildReorderCart(order: Order, restaurant: Restaurant | null, currentMenuItems: MenuItem[]): ReorderResult {
  if (!restaurant || !restaurant.isOpen) {
    return { addableLines: [], unavailableItems: [], restaurantUnavailable: true };
  }

  const addableLines: CartLineItem[] = [];
  const unavailableItems: { name: string; reason: string }[] = [];

  for (const orderItem of order.items) {
    const current = currentMenuItems.find((m) => m.id === orderItem.menuItemId);
    if (!current) {
      unavailableItems.push({ name: orderItem.name, reason: "This item is no longer available on the menu" });
      continue;
    }
    if (!current.isAvailable) {
      unavailableItems.push({ name: orderItem.name, reason: "This item is temporarily unavailable" });
      continue;
    }
    addableLines.push({
      lineId: `${current.id}-reorder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: current.id,
      restaurantId: current.restaurantId,
      quantity: orderItem.quantity,
      customization: orderItem.customization,
      unitPrice: calculateLineItemPrice(current, orderItem.customization), // current price, never the historical one
    });
  }

  return { addableLines, unavailableItems, restaurantUnavailable: false };
}
