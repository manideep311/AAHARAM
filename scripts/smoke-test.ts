// Exercises the deployed place-order / cancel-order functions end to end.
// Run after deploying: npx tsx scripts/smoke-test.ts
import { admin, anonClient, assert, check, createTestUser, deleteTestUser, finish, type TestUser } from "./script-env";
import { calculateCartTotals } from "../supabase/functions/_shared/pricing";
import { menuItemFromRow, restaurantFromRow } from "../supabase/functions/_shared/mappers";
import { toOrderError } from "../services/order-errors";
import type { SupabaseClient } from "@supabase/supabase-js";

async function invoke(client: SupabaseClient, name: string, body: object) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) return { order: null, error: await toOrderError(error) };
  return { order: (data as { order: Record<string, unknown> }).order, error: null };
}

const requestId = () => `smoke-${crypto.randomUUID()}`;

async function main() {
  let user: TestUser | undefined;
  try {
    user = await createTestUser("smoke");
    const address = await user.client
      .from("addresses")
      .insert({ label: "Home", recipient_name: "Smoke", phone: "9000000003", line1: "3 Test St", area: "Area", city: "City", state: "State", postal_code: "560003" })
      .select("id")
      .single();
    if (address.error) throw address.error;

    const restaurantRow = await admin.from("restaurants").select("*").eq("id", "r1").single();
    const itemRow = await admin.from("menu_items").select("*").eq("id", "m1").single();
    if (restaurantRow.error || itemRow.error) throw restaurantRow.error ?? itemRow.error;
    const restaurant = restaurantFromRow(restaurantRow.data);
    const item = menuItemFromRow(itemRow.data);
    const customization = { optionSelections: { og1: "opt1" }, addOnIds: [] as string[] };
    const expected = calculateCartTotals(
      [{ lineId: "l1", menuItemId: "m1", restaurantId: "r1", quantity: 2, customization, unitPrice: 0 }],
      [item],
      restaurant,
      null
    );

    const baseBody = {
      restaurantId: "r1",
      lines: [{ menuItemId: "m1", quantity: 2, customization }],
      couponCode: null,
      addressId: address.data.id,
      paymentMethod: "upi",
      expectedTotal: expected.total,
    };
    const firstRequestId = requestId();
    let firstOrderId = "";

    await check("place-order creates a server-priced order", async () => {
      const { order, error } = await invoke(user!.client, "place-order", { ...baseBody, clientRequestId: firstRequestId });
      assert(!error && order, `unexpected error: ${error?.code} ${error?.message}`);
      assert(order.total === expected.total, `total ${order.total} != ${expected.total}`);
      assert(order.payment_status === "paid_simulated", `payment_status ${order.payment_status}`);
      firstOrderId = order.id as string;
    });

    await check("replaying the same clientRequestId returns the same order", async () => {
      const { order, error } = await invoke(user!.client, "place-order", { ...baseBody, clientRequestId: firstRequestId });
      assert(!error && order?.id === firstOrderId, `got ${order?.id ?? error?.code}`);
    });

    await check("a closed restaurant is rejected", async () => {
      const { error } = await invoke(user!.client, "place-order", {
        ...baseBody,
        clientRequestId: requestId(),
        restaurantId: "r11",
        lines: [{ menuItemId: "m45", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } }],
      });
      assert(error?.code === "RESTAURANT_CLOSED", `got ${error?.code ?? "success"}`);
    });

    await check("a tampered total is rejected with PRICE_CHANGED", async () => {
      const { error } = await invoke(user!.client, "place-order", { ...baseBody, clientRequestId: requestId(), expectedTotal: 1 });
      assert(error?.code === "PRICE_CHANGED", `got ${error?.code ?? "success"}`);
      assert((error.details?.totals as { total: number }).total === expected.total, "PRICE_CHANGED did not return server totals");
    });

    await check("signed-out callers are rejected", async () => {
      const { error } = await invoke(anonClient(), "place-order", { ...baseBody, clientRequestId: requestId() });
      assert(error?.code === "UNAUTHORIZED", `got ${error?.code ?? "success"}`);
    });

    await check("a placed order can be cancelled and is refunded", async () => {
      const { order, error } = await invoke(user!.client, "cancel-order", { orderId: firstOrderId });
      assert(!error && order, `unexpected error: ${error?.code}`);
      assert(order.status === "cancelled" && order.payment_status === "refunded_simulated", `got ${order.status}/${order.payment_status}`);
    });

    await check("a delivered order cannot be cancelled", async () => {
      const placed = await invoke(user!.client, "place-order", { ...baseBody, clientRequestId: requestId(), paymentMethod: "cod" });
      assert(placed.order, `place failed: ${placed.error?.code}`);
      const forced = await admin.from("orders").update({ status: "delivered" }).eq("id", placed.order.id as string);
      if (forced.error) throw forced.error;
      const { error } = await invoke(user!.client, "cancel-order", { orderId: placed.order.id });
      assert(error?.code === "NOT_CANCELLABLE", `got ${error?.code ?? "success"}`);
    });

    await check("status changes create notifications", async () => {
      const { data } = await user!.client.from("notifications").select("title");
      const titles = (data ?? []).map((n: { title: string }) => n.title);
      assert(titles.includes("Order cancelled") && titles.includes("Delivered"), `got ${JSON.stringify(titles)}`);
    });
  } finally {
    await deleteTestUser(user);
  }
  finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
