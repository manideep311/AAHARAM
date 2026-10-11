import AsyncStorage from "@react-native-async-storage/async-storage";
import { Order, OrderStatus, CartLineItem, MenuItem, Restaurant, Coupon, Address, PaymentMethod } from "../types/domain";
import { calculateCartTotals } from "../lib/pricing/calculate";
import { SEED_ORDERS } from "../data/seed/orders";

const ORDERS_KEY = "crave:orders";
const REQUEST_IDS_KEY = "crave:order-request-ids";

async function readOrders(): Promise<Order[]> {
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  if (raw) return JSON.parse(raw);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(SEED_ORDERS));
  return SEED_ORDERS;
}

export async function getOrders(): Promise<Order[]> {
  const orders = await readOrders();
  return [...orders].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
}

export async function getOrderById(id: string): Promise<Order | null> {
  const orders = await readOrders();
  return orders.find((o) => o.id === id) ?? null;
}

export interface CreateOrderInput {
  clientRequestId: string;
  restaurant: Restaurant;
  lines: CartLineItem[];
  menuItems: MenuItem[];
  coupon: Coupon | null;
  address: Address;
  paymentMethod: PaymentMethod;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const seenRaw = await AsyncStorage.getItem(REQUEST_IDS_KEY);
  const seen: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
  if (seen[input.clientRequestId]) {
    const existing = await getOrderById(seen[input.clientRequestId]);
    if (existing) return existing; // idempotent replay: return the already-created order, never duplicate
  }

  const totals = calculateCartTotals(input.lines, input.menuItems, input.restaurant, input.coupon);
  const order: Order = {
    id: `ord${Date.now()}`,
    restaurantId: input.restaurant.id,
    restaurantName: input.restaurant.name,
    items: input.lines.map((line) => {
      const item = input.menuItems.find((m) => m.id === line.menuItemId)!;
      return { menuItemId: item.id, name: item.name, quantity: line.quantity, unitPrice: line.unitPrice, customization: line.customization };
    }),
    status: "placed" as OrderStatus,
    placedAt: new Date().toISOString(),
    addressId: input.address.id,
    paymentMethod: input.paymentMethod,
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    tax: totals.tax,
    total: totals.total,
    couponCode: input.coupon?.code,
    etaMinutes: input.restaurant.etaMinutes,
  };

  const orders = await readOrders();
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify([...orders, order]));
  await AsyncStorage.setItem(REQUEST_IDS_KEY, JSON.stringify({ ...seen, [input.clientRequestId]: order.id }));
  return order;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const orders = await readOrders();
  const next = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(next));
}
