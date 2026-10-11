// Shared order-status metadata used by OrderCard, TrackingTimeline, and the order-details /
// tracking screens, so the status sequence, labels, and tone mapping all live in exactly one
// place instead of being re-derived ad hoc in each UI file.
import {
  LucideIcon,
  ClipboardCheck,
  ChefHat,
  CookingPot,
  PackageCheck,
  Truck,
  PartyPopper,
  XCircle,
} from "lucide-react-native";
import { OrderStatus } from "../../types/domain";

// The 7 "happy path" statuses a normal order progresses through, placed -> delivered.
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "picked_up",
  "out_for_delivery",
  "delivered",
];

const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled", "failed"];

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
};

export type BadgeTone = "primary" | "success" | "muted" | "danger";

export function orderStatusTone(status: OrderStatus): BadgeTone {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "failed") return "danger";
  return "primary";
}

export function orderStatusIcon(status: OrderStatus): LucideIcon | undefined {
  switch (status) {
    case "placed":
      return ClipboardCheck;
    case "confirmed":
      return ChefHat;
    case "preparing":
      return CookingPot;
    case "ready":
      return PackageCheck;
    case "picked_up":
    case "out_for_delivery":
      return Truck;
    case "delivered":
      return PartyPopper;
    case "cancelled":
    case "failed":
      return XCircle;
    default:
      return undefined;
  }
}

// Status immediately following `status` in the happy-path sequence, or null once at/after
// "delivered" or if `status` is a terminal status not part of the sequence (cancelled/failed).
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUS_SEQUENCE.indexOf(status);
  if (index === -1 || index === ORDER_STATUS_SEQUENCE.length - 1) return null;
  return ORDER_STATUS_SEQUENCE[index + 1];
}
