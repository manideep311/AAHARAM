import { isOrderErrorCode, type OrderErrorBody, type OrderErrorCode } from "../supabase/functions/_shared/order-errors";

export class OrderError extends Error {
  code: OrderErrorCode | "NETWORK";
  details?: Record<string, unknown>;

  constructor(code: OrderErrorCode | "NETWORK", message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OrderError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Converts the `error` returned by `supabase.functions.invoke` into an OrderError.
 * HTTP errors carry the Response in `error.context`; transport failures don't have a
 * readable body and become NETWORK (safe to retry with the same clientRequestId).
 */
export async function toOrderError(error: unknown): Promise<OrderError> {
  const context = (error as { context?: unknown } | null)?.context as { json?: () => Promise<unknown> } | undefined;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: Partial<OrderErrorBody> } | null;
      if (body?.error && isOrderErrorCode(body.error.code)) {
        return new OrderError(body.error.code, body.error.message ?? "Something went wrong", body.error.details);
      }
    } catch {
      // unreadable body: fall through to INTERNAL
    }
    return new OrderError("INTERNAL", "Something went wrong. Please try again.");
  }
  return new OrderError("NETWORK", "Couldn't reach the server. Check your connection and try again.");
}
