import { z } from "npm:zod@4";
import { CANCELLABLE_STATUSES, isCancellable } from "../_shared/place-order-core.ts";
import { corsHeaders, errorResponse, json } from "../_server/http.ts";
import { getCallerId, serviceClient } from "../_server/clients.ts";

const bodySchema = z.object({ orderId: z.uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse({ code: "INVALID_INPUT", message: "Use POST" });

  try {
    const admin = serviceClient();
    const userId = await getCallerId(req, admin);
    if (!userId) return errorResponse({ code: "UNAUTHORIZED", message: "Please sign in to cancel an order" });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return errorResponse({ code: "INVALID_INPUT", message: "Invalid cancel request" });

    const found = await admin.from("orders").select("*").eq("id", parsed.data.orderId).eq("user_id", userId).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) return errorResponse({ code: "NOT_FOUND", message: "Order not found" });
    if (!isCancellable(found.data.status)) {
      return errorResponse({ code: "NOT_CANCELLABLE", message: "This order is already being prepared and can't be cancelled" });
    }

    // The status filter makes this safe against the tracking job advancing the order meanwhile.
    const updated = await admin
      .from("orders")
      .update({
        status: "cancelled",
        status_updated_at: new Date().toISOString(),
        payment_status: found.data.payment_status === "paid_simulated" ? "refunded_simulated" : found.data.payment_status,
      })
      .eq("id", parsed.data.orderId)
      .eq("user_id", userId)
      .in("status", CANCELLABLE_STATUSES)
      .select("*")
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) {
      return errorResponse({ code: "NOT_CANCELLABLE", message: "This order is already being prepared and can't be cancelled" });
    }
    return json({ order: updated.data });
  } catch (err) {
    console.error("cancel-order failed", err);
    return errorResponse({ code: "INTERNAL", message: "Something went wrong cancelling your order. Please try again." });
  }
});
