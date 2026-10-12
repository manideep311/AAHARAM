import { supabase } from "../lib/supabase";
import { Order } from "../types/domain";
import { orderFromRow, type OrderRow } from "../supabase/functions/_shared/mappers";
import type { PlaceOrderInput } from "../supabase/functions/_shared/place-order-core";
import { toOrderError } from "./order-errors";

export type CreateOrderInput = PlaceOrderInput;

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from("orders").select("*").order("placed_at", { ascending: false });
  if (error) throw error;
  return (data as OrderRow[]).map(orderFromRow);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? orderFromRow(data as OrderRow) : null;
}

async function invokeOrderFunction(name: "place-order" | "cancel-order", body: object): Promise<Order> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw await toOrderError(error);
  return orderFromRow((data as { order: OrderRow }).order);
}

/** Server-priced, idempotent on clientRequestId. Throws OrderError. */
export function createOrder(input: CreateOrderInput): Promise<Order> {
  return invokeOrderFunction("place-order", input);
}

/** Allowed while the order is placed or confirmed. Throws OrderError. */
export function cancelOrder(orderId: string): Promise<Order> {
  return invokeOrderFunction("cancel-order", { orderId });
}
