// The authoritative order checks, as a pure function. The place-order Edge Function fetches
// the rows, calls this, and inserts `row` on success; Jest tests call it directly.
import type {
  Address, CartCustomization, CartLineItem, Coupon, MenuItem, OrderItem, OrderStatus, PaymentMethod,
  PaymentStatus, Restaurant,
} from "./domain.ts";
import { calculateCartTotals, calculateLineItemPrice, type CartTotals } from "./pricing.ts";
import { checkCoupon } from "./coupons.ts";
import type { OrderErrorBody, OrderErrorCode } from "./order-errors.ts";

export interface PlaceOrderLineInput {
  menuItemId: string;
  quantity: number;
  customization: CartCustomization;
}

export interface PlaceOrderInput {
  clientRequestId: string;
  restaurantId: string;
  lines: PlaceOrderLineInput[];
  couponCode?: string | null;
  addressId: string;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string | null;
  /** The total the user saw on screen; a mismatch yields PRICE_CHANGED instead of an order. */
  expectedTotal: number;
}

export interface PlaceOrderCatalog {
  restaurant: Restaurant | null;
  /** The menu items referenced by `input.lines` (missing ones are simply absent). */
  menuItems: MenuItem[];
  /** The coupon row for `input.couponCode`, or null when no code was sent or none matched. */
  coupon: Coupon | null;
  /** The address row for `input.addressId`, already filtered to the caller. */
  address: Address | null;
}

export interface NewOrderRow {
  user_id: string;
  client_request_id: string;
  restaurant_id: string;
  restaurant_name: string;
  items: OrderItem[];
  address: Address;
  delivery_instructions: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: "placed";
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  eta_minutes: number;
}

export type PlaceOrderResult = { ok: true; row: NewOrderRow; totals: CartTotals } | { ok: false; error: OrderErrorBody };

export const CANCELLABLE_STATUSES: OrderStatus[] = ["placed", "confirmed"];

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

function fail(code: OrderErrorCode, message: string, details?: Record<string, unknown>): PlaceOrderResult {
  return { ok: false, error: details ? { code, message, details } : { code, message } };
}

function customizationProblem(item: MenuItem, customization: CartCustomization): string | null {
  for (const [groupId, optionId] of Object.entries(customization.optionSelections)) {
    const group = item.optionGroups.find((g) => g.id === groupId);
    if (!group || !group.options.some((o) => o.id === optionId)) return `Invalid option selected for ${item.name}`;
  }
  for (const group of item.optionGroups) {
    if (group.required && !customization.optionSelections[group.id]) {
      return `Choose a ${group.name.toLowerCase()} for ${item.name}`;
    }
  }
  for (const addOnId of customization.addOnIds) {
    if (!item.addOns.some((a) => a.id === addOnId)) return `Invalid add-on selected for ${item.name}`;
  }
  return null;
}

export function validateAndPriceOrder(
  input: PlaceOrderInput,
  catalog: PlaceOrderCatalog,
  userId: string,
  now: Date
): PlaceOrderResult {
  const { restaurant, address } = catalog;
  if (!restaurant) return fail("NOT_FOUND", "Restaurant not found");
  if (!restaurant.isOpen) return fail("RESTAURANT_CLOSED", `${restaurant.name} is currently closed and cannot accept orders.`);
  if (!address) return fail("NOT_FOUND", "Delivery address not found");
  if (input.lines.length === 0) return fail("INVALID_INPUT", "Your cart is empty");

  const unavailable = input.lines
    .filter((line) => {
      const item = catalog.menuItems.find((m) => m.id === line.menuItemId);
      return !item || item.restaurantId !== restaurant.id || !item.isAvailable;
    })
    .map((line) => line.menuItemId);
  if (unavailable.length > 0) {
    return fail("ITEM_UNAVAILABLE", "Some items in your cart are no longer available", { menuItemIds: unavailable });
  }

  const serverLines: CartLineItem[] = [];
  const orderItems: OrderItem[] = [];
  for (const [index, line] of input.lines.entries()) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) return fail("INVALID_INPUT", "Quantity must be at least 1");
    const item = catalog.menuItems.find((m) => m.id === line.menuItemId)!;
    const problem = customizationProblem(item, line.customization);
    if (problem) return fail("INVALID_INPUT", problem);
    // Never trust a client price: unit prices come only from the menu row + selected options.
    const unitPrice = calculateLineItemPrice(item, line.customization);
    serverLines.push({
      lineId: `line-${index}`,
      menuItemId: item.id,
      restaurantId: item.restaurantId,
      quantity: line.quantity,
      customization: line.customization,
      unitPrice,
    });
    orderItems.push({ menuItemId: item.id, name: item.name, quantity: line.quantity, unitPrice, customization: line.customization });
  }

  const { subtotal } = calculateCartTotals(serverLines, catalog.menuItems, restaurant, null);

  let coupon: Coupon | null = null;
  if (input.couponCode) {
    if (!catalog.coupon) return fail("COUPON_INVALID", "Invalid coupon code", { reason: "Invalid coupon code" });
    const check = checkCoupon(catalog.coupon, subtotal, restaurant.id, now);
    if (!check.ok) return fail("COUPON_INVALID", check.reason, { reason: check.reason });
    coupon = catalog.coupon;
  }

  if (subtotal < restaurant.minOrderAmount) {
    const shortfall = restaurant.minOrderAmount - subtotal;
    return fail("BELOW_MIN_ORDER", `Add items worth ₹${shortfall} more to place this order`, { shortfall });
  }

  const totals = calculateCartTotals(serverLines, catalog.menuItems, restaurant, coupon);
  if (totals.total !== input.expectedTotal) {
    return fail("PRICE_CHANGED", "Prices have changed since you reviewed your order", { totals });
  }

  return {
    ok: true,
    totals,
    row: {
      user_id: userId,
      client_request_id: input.clientRequestId,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      items: orderItems,
      address,
      delivery_instructions: input.deliveryInstructions?.trim() || null,
      payment_method: input.paymentMethod,
      payment_status: input.paymentMethod === "cod" ? "pending_cod" : "paid_simulated",
      status: "placed",
      subtotal: totals.subtotal,
      discount: totals.discount,
      delivery_fee: totals.deliveryFee,
      tax: totals.tax,
      total: totals.total,
      coupon_code: coupon?.code ?? null,
      eta_minutes: restaurant.etaMinutes,
    },
  };
}
