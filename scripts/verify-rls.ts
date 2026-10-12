// Verifies Row Level Security against the hosted project with two throwaway users.
// Run: npx tsx scripts/verify-rls.ts   (needs .env and .env.local, see docs/backend-setup.md)
import { admin, anonClient, assert, check, createTestUser, deleteTestUser, finish, type TestUser } from "./script-env";

function orderRow(userId: string) {
  return {
    user_id: userId,
    client_request_id: `rls-${crypto.randomUUID()}`,
    restaurant_id: "r1",
    restaurant_name: "Biryani Junction",
    items: [],
    address: {},
    payment_method: "cod",
    payment_status: "pending_cod",
    subtotal: 100,
    total: 100,
    eta_minutes: 30,
  };
}

async function main() {
  let a: TestUser | undefined;
  let b: TestUser | undefined;
  try {
    a = await createTestUser("rls-a");
    b = await createTestUser("rls-b");
    const anon = anonClient();

    const addressA = await a.client
      .from("addresses")
      .insert({ label: "Home", recipient_name: "A", phone: "9000000001", line1: "1 Test St", area: "Area", city: "City", state: "State", postal_code: "560001" })
      .select("id")
      .single();
    if (addressA.error) throw addressA.error;
    const favA = await a.client.from("favorites").insert({ kind: "restaurant", target_id: "r1" });
    if (favA.error) throw favA.error;
    const orderA = await admin.from("orders").insert(orderRow(a.id)).select("id").single();
    if (orderA.error) throw orderA.error;
    const notificationA = await admin
      .from("notifications")
      .insert({ user_id: a.id, order_id: orderA.data.id, title: "Test", body: "Test" })
      .select("id")
      .single();
    if (notificationA.error) throw notificationA.error;

    await check("anon can read the catalog", async () => {
      const { data, error } = await anon.from("restaurants").select("id").limit(1);
      assert(!error && data && data.length === 1, `expected a restaurant, got ${JSON.stringify(error ?? data)}`);
    });

    for (const table of ["profiles", "addresses", "favorites", "orders", "notifications"]) {
      await check(`anon sees no rows in ${table}`, async () => {
        const { data } = await anon.from(table).select("*");
        assert((data ?? []).length === 0, `anon saw ${data?.length} row(s)`);
      });
      await check(`user B sees none of user A's ${table}`, async () => {
        const { data } = await b!.client.from(table).select("*");
        const leaked = (data ?? []).filter((row: Record<string, unknown>) => row.user_id === a!.id || row.id === a!.id);
        assert(leaked.length === 0, `B saw ${leaked.length} of A's row(s)`);
      });
    }

    await check("user A sees their own order", async () => {
      const { data } = await a!.client.from("orders").select("id");
      assert(data?.length === 1, `expected 1 order, got ${data?.length}`);
    });

    await check("user B cannot update user A's address", async () => {
      const { data } = await b!.client.from("addresses").update({ city: "Hacked" }).eq("id", addressA.data.id).select("id");
      assert((data ?? []).length === 0, "update affected A's row");
    });

    await check("users cannot insert orders directly", async () => {
      const { error } = await a!.client.from("orders").insert(orderRow(a!.id));
      assert(error, "insert unexpectedly succeeded");
    });

    await check("users cannot change their order's status", async () => {
      const { data, error } = await a!.client.from("orders").update({ status: "delivered" }).eq("id", orderA.data.id).select("id");
      assert(error || (data ?? []).length === 0, "status update unexpectedly succeeded");
    });

    await check("users can mark their notification read", async () => {
      const { data, error } = await a!.client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationA.data.id)
        .select("id");
      assert(!error && data?.length === 1, `mark read failed: ${error?.message}`);
    });

    await check("users cannot rewrite a notification's text", async () => {
      const { error } = await a!.client.from("notifications").update({ title: "Hacked" }).eq("id", notificationA.data.id);
      assert(error, "title update unexpectedly succeeded");
    });

    await check("users can rename themselves", async () => {
      const { data, error } = await a!.client.from("profiles").update({ name: "Asha" }).eq("id", a!.id).select("name");
      assert(!error && data?.[0]?.name === "Asha", `rename failed: ${error?.message}`);
    });

    await check("users cannot change their profile email", async () => {
      const { error } = await a!.client.from("profiles").update({ email: "x@example.com" }).eq("id", a!.id);
      assert(error, "email update unexpectedly succeeded");
    });

    await check("users cannot add favorites for someone else", async () => {
      const { error } = await b!.client.from("favorites").insert({ user_id: a!.id, kind: "restaurant", target_id: "r2" });
      assert(error, "insert for another user unexpectedly succeeded");
    });

    await check("the tracking job cannot be called through the API", async () => {
      const { error } = await a!.client.rpc("advance_order_statuses");
      assert(error, "rpc unexpectedly succeeded");
    });
  } finally {
    await deleteTestUser(a);
    await deleteTestUser(b);
  }
  finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
