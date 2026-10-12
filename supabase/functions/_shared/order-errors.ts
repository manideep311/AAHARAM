// Error contract between the order Edge Functions and the app. Every failure response is
// `HTTP <ORDER_ERROR_STATUS[code]>` with body `{ error: OrderErrorBody }`.
export type OrderErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RESTAURANT_CLOSED"
  | "ITEM_UNAVAILABLE"
  | "COUPON_INVALID"
  | "BELOW_MIN_ORDER"
  | "PRICE_CHANGED"
  | "NOT_CANCELLABLE"
  | "INTERNAL";

export interface OrderErrorBody {
  code: OrderErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export const ORDER_ERROR_STATUS: Record<OrderErrorCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  RESTAURANT_CLOSED: 409,
  ITEM_UNAVAILABLE: 409,
  COUPON_INVALID: 409,
  BELOW_MIN_ORDER: 409,
  PRICE_CHANGED: 409,
  NOT_CANCELLABLE: 409,
  INTERNAL: 500,
};

export function isOrderErrorCode(value: unknown): value is OrderErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ORDER_ERROR_STATUS, value);
}
