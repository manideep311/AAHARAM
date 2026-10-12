import { z } from "npm:zod@4";
import { validateAndPriceOrder } from "../_shared/place-order-core.ts";
import { addressFromRow, couponFromRow, menuItemFromRow, restaurantFromRow } from "../_shared/mappers.ts";
import { corsHeaders, errorResponse, json } from "../_server/http.ts";
import { getCallerId, serviceClient } from "../_server/clients.ts";

const customizationSchema = z.object({
  optionSelections: z.record(z.string(), z.string()),
  addOnIds: z.array(z.string()),
  spiceLevel: z.enum(["mild", "medium", "spicy"]).optional(),
  specialInstructions: z.string().max(140).optional(),
});

const bodySchema = z.object({
  clientRequestId: z.string().min(8).max(100),
  restaurantId: z.string().min(1),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        customization: customizationSchema,
      })
    )
    .min(1)
    .max(50),
  couponCode: z.string().trim().min(1).max(40).nullish(),
  addressId: z.uuid(),
  paymentMethod: z.enum(["upi", "card", "netbanking", "cod"]),
  deliveryInstructions: z.string().max(280).nullish(),
  expectedTotal: z.number().int().min(0),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse({ code: "INVALID_INPUT", message: "Use POST" });

  try {
    const admin = serviceClient();
    const userId = await getCallerId(req, admin);
    if (!userId) return errorResponse({ code: "UNAUTHORIZED", message: "Please sign in to place an order" });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse({
        code: "INVALID_INPUT",
        message: "Invalid order request",
        details: { issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) },
      });
    }
    const input = parsed.data;

    // Idempotent replay: the same (user, clientRequestId) always returns the same order.
    const existing = await admin
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .eq("client_request_id", input.clientRequestId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return json({ order: existing.data });

    const couponCode = input.couponCode ? input.couponCode.toUpperCase() : null;
    const menuItemIds = [...new Set(input.lines.map((line) => line.menuItemId))];

    const [restaurantRes, itemsRes, couponRes, addressRes] = await Promise.all([
      admin.from("restaurants").select("*").eq("id", input.restaurantId).maybeSingle(),
      admin.from("menu_items").select("*").in("id", menuItemIds),
      couponCode
        ? admin.from("coupons").select("*").eq("code", couponCode).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from("addresses").select("*").eq("id", input.addressId).eq("user_id", userId).maybeSingle(),
    ]);
    if (restaurantRes.error) throw restaurantRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (couponRes.error) throw couponRes.error;
    if (addressRes.error) throw addressRes.error;

    const result = validateAndPriceOrder(
      {
        clientRequestId: input.clientRequestId,
        restaurantId: input.restaurantId,
        lines: input.lines,
        couponCode,
        addressId: input.addressId,
        paymentMethod: input.paymentMethod,
        deliveryInstructions: input.deliveryInstructions ?? null,
        expectedTotal: input.expectedTotal,
      },
      {
        restaurant: restaurantRes.data ? restaurantFromRow(restaurantRes.data) : null,
        menuItems: (itemsRes.data ?? []).map(menuItemFromRow),
        coupon: couponRes.data ? couponFromRow(couponRes.data) : null,
        address: addressRes.data ? addressFromRow(addressRes.data) : null,
      },
      userId,
      new Date()
    );
    if (!result.ok) return errorResponse(result.error);

    // ON CONFLICT DO NOTHING + re-read: two simultaneous submissions converge on one order.
    const inserted = await admin
      .from("orders")
      .upsert(result.row, { onConflict: "user_id,client_request_id", ignoreDuplicates: true });
    if (inserted.error) throw inserted.error;

    const saved = await admin
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .eq("client_request_id", input.clientRequestId)
      .single();
    if (saved.error) throw saved.error;
    return json({ order: saved.data });
  } catch (err) {
    console.error("place-order failed", err);
    return errorResponse({ code: "INTERNAL", message: "Something went wrong placing your order. Please try again." });
  }
});
