# AAHARAM Sub-project 2: Supabase Backend + Real Auth — Design

**Date:** 2026-10-12
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** Sub-project 1 (`docs/superpowers/plans/2026-10-11-crave-foundation-customer-ui.md`) — a complete Expo customer app running on local seed data behind an async `services/` layer.
**Followed by:** Sub-project 3 (real AI assistant via Edge Function), Sub-project 4 (push notifications, loyalty, admin).

## 1. Goal and constraints

Replace the local-only data layer with a real Supabase backend so that AAHARAM works as a genuine multi-user app: real email sign-in, server-owned orders, server-authoritative pricing, and server-driven order tracking with live updates.

**Product context:** AAHARAM is a **portfolio/showcase** project. Everything runs on free tiers; no real money moves; payments remain an explicitly labeled simulation.

**Decisions locked in brainstorming:**

| Topic | Decision |
|---|---|
| Purpose | Portfolio / showcase, free tiers only |
| Sign-in | Email OTP (6-digit code) + local guest mode |
| Payments | Server-side simulation (no gateway) |
| Guests | Browse, search, build cart, use assistant; must sign in to check out, favorite, or manage addresses |
| Supabase | Hosted free project; migrations as files in repo; no Docker |
| Server logic | Edge Functions (TypeScript) for trusted writes; RLS for reads (Approach B) |

**Carried-over global constraints from Sub-project 1:** brand via `constants/brand.ts`; colors via `constants/theme.ts`; INR via `formatCurrency`; every simulated integration visibly labeled; every list screen has skeleton/empty/error states; auth session stored via SecureStore; no final payable total computed in a component.

## 2. Architecture

```
 Expo app ──supabase-js──► Postgres (RLS)          reads: catalog, own profile/addresses/favorites/orders/notifications
     │                         ▲   │
     │                         │   └─ pg_cron (30s) advance_order_statuses() ─► trigger ─► notifications row
     │                         │
     └──functions.invoke──► Edge Functions          writes needing trust: place-order, cancel-order
                               (service role)
     ◄──────── Realtime (postgres_changes on orders, notifications; RLS-filtered) ────────
```

- **Reads** go straight from the app to Postgres through `supabase-js`, protected by Row Level Security.
- **Trusted writes** (order creation, cancellation) go through Edge Functions that use the service-role key. Clients have no INSERT/UPDATE rights on `orders`.
- **Tracking** is simulated server-side by a pg_cron job; status changes reach the app via Supabase Realtime.
- **Device-local state (unchanged):** cart, preferences, recent searches, onboarding-seen flag, checkout address selection. These stay in Zustand/AsyncStorage.

## 3. Data model

All tables in `public`. Catalog tables keep Sub-project 1's text IDs (`r1`, `m12`, `c4`) so carts persisted on devices remain valid.

### 3.1 Catalog (public read, no client writes)

- **`restaurants`** — `id text pk`, `name`, `phone`, `cuisines text[]`, `cover_image_url`, `rating numeric`, `rating_count int`, `price_range smallint check (1..3)`, `eta_minutes int`, `delivery_fee int`, `min_order_amount int`, `is_open boolean`, `opens_at text`, `closes_at text`, `offer_ids text[]`, `tags text[]`.
- **`menu_categories`** — `id text pk`, `restaurant_id fk`, `name`, `sort_order int`.
- **`menu_items`** — `id text pk`, `restaurant_id fk`, `category_id fk`, `name`, `description`, `image_url`, `base_price int`, `veg_flag text check in (veg, non-veg, egg, unknown)`, `rating numeric null`, `is_available boolean`, `option_groups jsonb`, `add_ons jsonb`, `supports_spice_level boolean`, `popular boolean`.
- **`offers`** — `id text pk`, `restaurant_id null`, `title`, `description`, `coupon_code null`.
- **`coupons`** — `code text pk`, `description`, `type text check in (percentage, fixed, free-delivery)`, `value int`, `min_order_amount int`, `max_discount int null`, `restaurant_id null`, `expires_at timestamptz`.

RLS: `select` allowed for `anon` and `authenticated`; no insert/update/delete policies.

All money columns are integer rupees, matching the existing domain types.

### 3.2 User data

- **`profiles`** — `id uuid pk references auth.users on delete cascade`, `name text null`, `email text`, `created_at`. Row auto-created by an `after insert on auth.users` trigger (`security definer`). RLS: user selects/updates own row (`id = auth.uid()`); only `name` is updatable, enforced with a column-level grant (`revoke update on profiles from authenticated; grant update (name) on profiles to authenticated`).
- **`addresses`** — `id uuid pk default gen_random_uuid()`, `user_id uuid fk default auth.uid()`, `label text check in (Home, Work, Other)`, `recipient_name`, `phone`, `line1`, `area`, `city`, `state`, `postal_code`, `landmark null`, `instructions null`, `is_default boolean`, `lat/lng null`, `created_at`. Partial unique index `(user_id) where is_default` enforces at most one default. Setting a new default is done by a `set_default_address(address_id)` SQL function (security invoker) that clears the old default and sets the new one in one statement. RLS: full CRUD on own rows.
- **`favorites`** — `user_id uuid default auth.uid()`, `kind text check in (restaurant, menu_item)`, `target_id text`, `created_at`, `primary key (user_id, kind, target_id)`. RLS: select/insert/delete own rows.

### 3.3 Orders and notifications

- **`orders`** —
  `id uuid pk`, `user_id uuid fk`, `client_request_id text`,
  `restaurant_id text fk`, `restaurant_name text` (snapshot),
  `items jsonb` (snapshot: `[{menuItemId, name, quantity, unitPrice, customization}]`),
  `address jsonb` (snapshot of the full address at order time), `delivery_instructions text null`,
  `payment_method text check in (upi, card, netbanking, cod)`,
  `payment_status text check in (paid_simulated, pending_cod, refunded_simulated)`,
  `status text check in (placed, confirmed, preparing, ready, picked_up, out_for_delivery, delivered, cancelled, failed)`,
  `subtotal`, `discount`, `delivery_fee`, `tax`, `total` (int), `coupon_code null`, `eta_minutes int`,
  `placed_at timestamptz default now()`, `status_updated_at timestamptz default now()`.
  `unique (user_id, client_request_id)`.
  RLS: user selects own rows only. **No insert/update/delete policies for clients** — only Edge Functions (service role) and the cron function write.
- **`notifications`** — `id uuid pk`, `user_id uuid fk`, `order_id uuid null fk`, `title`, `body`, `read_at timestamptz null`, `created_at`. RLS: select own; update own restricted to setting `read_at` (enforced with a column-level grant: `grant update (read_at) on notifications to authenticated`).

**Realtime:** `alter publication supabase_realtime add table orders, notifications;`

### 3.4 Domain type changes

`types/domain.ts` (moved, see §5) changes:
- `Order.addressId: string` → `Order.address: Address` (snapshot) and new `Order.deliveryInstructions?: string`.
- New `Order.paymentStatus: "paid_simulated" | "pending_cod" | "refunded_simulated"`.
- New `Order.statusUpdatedAt: string`.
- `Address.id` becomes a server UUID (string type unchanged).
- `User` gains nothing; `User.phone` stays optional and unused by the new auth path. Signed-in users have `isGuest: false`, guests `isGuest: true` with `id: "guest"` (unchanged).

Screens that read `order.addressId` (order details) switch to `order.address`.

## 4. Auth and app integration

### 4.1 Supabase client

- `lib/supabase.ts` creates the client from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the project's legacy anon key or its newer `sb_publishable_…` key — `supabase-js` accepts either; the plan confirms which the dashboard shows). Likewise, Edge Functions read the platform-provided service-role/secret key env var; the plan confirms its exact name at implementation time. `.env` stays git-ignored (already in `.gitignore`); `.env.example` is committed with placeholder values.
- Session storage: `lib/secure-chunked-storage.ts`, a `supabase-js` storage adapter that splits values across numbered SecureStore keys (`<key>.0`, `<key>.1`, …, plus `<key>.count`) to stay under SecureStore's ~2 KB per-value limit. `getItem` reassembles; `removeItem` deletes all chunks.
- Client options: `auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }`. An `AppState` listener calls `supabase.auth.startAutoRefresh()` on foreground and `stopAutoRefresh()` on background (Supabase's documented Expo pattern).
- New dependencies: `@supabase/supabase-js`, `react-native-url-polyfill` (imported once at the top of `lib/supabase.ts`).

### 4.2 Email OTP flow

1. `app/auth/login.tsx`: phone field replaced by an email field (Zod `z.string().email()`), "Send code" calls `services/auth.requestOtp(email)` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`, then navigates to `/auth/otp?email=…` (plus `returnTo` if present). The "Dev mode" caption is removed. Errors (including the provider rate limit) show inline.
2. `app/auth/otp.tsx`: 6-digit input; "Verify" calls `services/auth.verifyOtp(email, code)` → `supabase.auth.verifyOtp({ email, token: code, type: "email" })`. The "Dev OTP" badge is removed. A "Resend code" link is enabled after 60 s.
3. After verification, the app fetches the user's `profiles` row. If `name` is null, `app/auth/location-select.tsx` shows a required "What should we call you?" field above the location step and saves it to `profiles`. Then: if `returnTo` was passed, `router.replace(returnTo)`; otherwise `/(tabs)/home`.
4. `store/auth-store.ts` is driven by `supabase.auth.onAuthStateChange` (subscribed once in `app/_layout.tsx`): on `SIGNED_IN`/`TOKEN_REFRESHED`/`INITIAL_SESSION` with a session → load profile → `setUser({ id, name, email, isGuest: false })`; on `SIGNED_OUT` → `setUser(null)` unless a guest session is active.
5. `services/auth.getCurrentUser()` returns the Supabase-backed user if a session exists, otherwise the locally stored guest user (SecureStore key `aaharam:guest`), otherwise `null`.
6. `signOut()` calls `supabase.auth.signOut()` and clears the guest key.

**Dashboard step (manual):** the "Magic Link" email template must include `{{ .Token }}` so the email carries the 6-digit code. Exact template text is provided in the implementation plan. Built-in Supabase email only delivers to the project organization's members at ~2 emails/hour; for anyone else to sign in, the owner connects a free SMTP provider (Brevo recommended) in the dashboard. No code change either way.

### 4.3 Guest gating

- `signInAsGuest()` stays local-only (no Supabase session).
- A `requireSignIn(returnTo: string)` helper (`features/auth/requireSignIn.ts`) returns `true` for signed-in users; for guests it navigates to `/auth/login?returnTo=<returnTo>` and returns `false`.
- Gated actions: "Proceed to Checkout" (cart), heart/favorite buttons (`RestaurantCard`, `FoodCard`, restaurant header), opening `/addresses`.
- Guest empty states ("Sign in to see your orders / favorites / notifications" with a Sign in button) on the Orders, Favorites, and Notifications screens.
- The cart is device-local, so it survives the guest → signed-in transition untouched.

### 4.4 Services layer

Function names and signatures are preserved except where noted; screens change only where listed.

| Service | New implementation |
|---|---|
| `restaurants.getRestaurants / getRestaurantById / getMenuForRestaurant / getMenuItemById` | `supabase.from(...)` selects, mapped snake_case → domain camelCase by `supabase/functions/_shared/mappers.ts`. Simulated latency removed. |
| `restaurants.getAllMenuItems()` (new) | Replaces direct `SEED_MENU_ITEMS` imports in `home.tsx`, `explore.tsx`, `favorites.tsx`. |
| `offers.getOffers()` (new file) | Replaces direct `SEED_OFFERS` imports in `home.tsx`, `restaurant/[id].tsx`, `RestaurantCard.tsx` (card receives offers via props/query instead of importing seed). |
| `search.searchAll(query)` | Calls SQL function `search_catalog(q text)` (security invoker, `ilike` over restaurant name, `array_to_string(cuisines)`, item name/description; items limited to open restaurants — preserving Sub-project 1's rule). |
| `coupons.validateCoupon(code, subtotal, restaurantId)` | Fetches the coupon row by code, then runs the shared `checkCoupon` rules (§5). Preview only — `place-order` re-validates. |
| `addresses.*` | Supabase CRUD on own rows; `saveAddress` with `isDefault` calls `set_default_address`. No first-run seeding. |
| `favorites.*` | Supabase select/insert/delete on `favorites`. `store/favorites-store.ts` keeps its API, loads from the service when signed in, and resets on sign-out. |
| `orders.getOrders / getOrderById` | Supabase selects on own orders. |
| `orders.createOrder(input)` | **Signature changes:** `CreateOrderInput` becomes `{ clientRequestId, restaurantId, lines: {menuItemId, quantity, customization}[], couponCode?, addressId, paymentMethod, deliveryInstructions?, expectedTotal }`. Calls `supabase.functions.invoke("place-order")`. Throws a typed `OrderError { code, message, details? }` on non-2xx. |
| `orders.cancelOrder(orderId)` (new) | Calls `cancel-order`. |
| `orders.updateOrderStatus` | **Deleted.** |
| `notifications.getNotifications / markAllRead` (new file) | Supabase select on own rows; `markAllRead` updates `read_at = now()` where null. |
| `assistant.*` | Unchanged in this sub-project (still uses bundled seed data, which is the same source as the DB seed). Replaced in Sub-project 3. |

`store/notifications-store.ts` is removed. Its consumers (`home.tsx`, `profile.tsx` badges, `notifications/index.tsx`) use a `useNotifications()` hook (`hooks/useNotifications.ts`) built on TanStack Query, exposing `{ items, unreadCount, markAllRead }`.

### 4.5 Realtime

`hooks/useRealtimeSync.ts`, mounted once in `app/_layout.tsx` while a non-guest user is signed in, subscribes to `postgres_changes` on `orders` and `notifications` filtered by `user_id=eq.<uid>`. On any event it invalidates the TanStack Query keys `["orders"]`, `["order", id]`, and `["notifications"]`. It unsubscribes on sign-out.

The tracking screen (`app/tracking/[orderId].tsx`) drops its 8-second local timer and its `pushNotification` calls. It keeps `useQuery(["order", orderId])` with `refetchInterval: 30_000` and refetch-on-app-foreground as a fallback when Realtime is disconnected. It gains a "Cancel order" button while status is `placed` or `confirmed`. The "Simulated tracking (development mode)" caption stays.

### 4.6 Local legacy data

On first launch of this version, `app/_layout.tsx` deletes the Sub-project 1 AsyncStorage keys `aaharam:orders`, `aaharam:order-request-ids`, `aaharam:addresses`, `aaharam:favorites:restaurants`, `aaharam:favorites:items` (guarded by a one-time `aaharam:migrated-v2` flag). They are not migrated. The cart, preferences, and recent-search keys are kept.

## 5. Shared code (app + Edge Functions)

New directory `supabase/functions/_shared/` holds pure, dependency-free TypeScript that both runtimes import:

- `domain.ts` — the domain types (moved from `types/domain.ts`; `types/domain.ts` becomes `export * from "../supabase/functions/_shared/domain.ts"`).
- `pricing.ts` — `calculateLineItemPrice` and `calculateCartTotals` (moved from `lib/pricing/calculate.ts`; that file re-exports).
- `coupons.ts` — `checkCoupon(coupon, subtotal, restaurantId, now): { ok: true } | { ok: false; reason }` (the rules currently inside `services/coupons.ts`).
- `place-order-core.ts` — `validateAndPriceOrder(input, catalog, userId, now)` (see §6.1). Pure: receives already-fetched rows, returns either `{ ok: true, order: NewOrderRow }` or `{ ok: false, code, message, details? }`.

Rules for `_shared`: no imports outside `_shared`; relative imports use explicit `.ts` extensions (required by Deno). The app's `tsconfig.json` adds `"allowImportingTsExtensions": true` (valid with Expo's `noEmit`) and excludes `supabase/functions/**` except `supabase/functions/_shared/**`. Jest (babel-preset-expo) resolves `.ts` extensions natively. This avoids relying on the CLI's experimental outside-directory import support.

## 6. Edge Functions

Both functions: Deno, `verify_jwt = false` with the caller verified in code via `auth.getUser(token)` (works with both legacy and new API keys), CORS headers for completeness, Zod input validation (`npm:zod`), and a service-role client (`SUPABASE_SERVICE_ROLE_KEY`, or the first entry of `SUPABASE_SECRET_KEYS`, both provided automatically in hosted functions) for privileged reads/writes.

Error response shape for every failure: HTTP status + `{ "error": { "code": string, "message": string, "details"?: object } }`.

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | No/invalid session |
| `INVALID_INPUT` | 400 | Body fails Zod, unknown option/add-on IDs, missing required option group, quantity < 1 |
| `NOT_FOUND` | 404 | Restaurant, address, or order not found / not owned |
| `RESTAURANT_CLOSED` | 409 | `is_open = false` |
| `ITEM_UNAVAILABLE` | 409 | One or more items unavailable or not from this restaurant; `details.menuItemIds` |
| `COUPON_INVALID` | 409 | `details.reason` from `checkCoupon` |
| `BELOW_MIN_ORDER` | 409 | `details.shortfall` in INR |
| `PRICE_CHANGED` | 409 | Server total ≠ `expectedTotal`; `details.totals` (full breakdown) |
| `NOT_CANCELLABLE` | 409 | Order status is past `confirmed` |
| `INTERNAL` | 500 | Unexpected failure (logged server-side) |

### 6.1 `place-order`

1. Identify caller → `UNAUTHORIZED` if none.
2. Parse body with Zod → `INVALID_INPUT`.
3. Idempotency fast path: select order by `(user_id, client_request_id)`; if found, return it (200).
4. Fetch restaurant, the referenced menu items, the coupon (if any), and the address (must have `user_id = caller`).
5. Run `validateAndPriceOrder`, which checks in order: restaurant exists (`NOT_FOUND`) and open (`RESTAURANT_CLOSED`); every item exists, belongs to the restaurant, and is available (`ITEM_UNAVAILABLE`); option/add-on IDs valid and every required group selected (`INVALID_INPUT`); unit prices computed server-side via `calculateLineItemPrice`; coupon valid via `checkCoupon` (`COUPON_INVALID`); subtotal ≥ `min_order_amount` (`BELOW_MIN_ORDER`); totals via `calculateCartTotals`; `total === expectedTotal` (`PRICE_CHANGED`).
6. Payment simulation: `cod` → `pending_cod`; otherwise `paid_simulated`.
7. Insert with `on conflict (user_id, client_request_id) do nothing`, then select by that key and return the row (200). This makes concurrent duplicate submissions converge on one order.

### 6.2 `cancel-order`

Body `{ orderId }`. Loads the order with `user_id = caller` (`NOT_FOUND`); if status not in (`placed`, `confirmed`) → `NOT_CANCELLABLE`; else sets `status = 'cancelled'`, `status_updated_at = now()`, and `payment_status = 'refunded_simulated'` when it was `paid_simulated`. Returns the updated order.

### 6.3 App-side error handling

`services/orders.ts` maps responses to `OrderError`. `app/checkout/payment.tsx` handles:
- network failure / `INTERNAL` → existing Retry button, same `clientRequestId`;
- `ITEM_UNAVAILABLE` → back to cart; affected lines show "No longer available";
- `COUPON_INVALID` → remove coupon from cart store, return to cart with the reason shown;
- `PRICE_CHANGED` → a confirm step showing the new `PriceBreakdown`; confirming resubmits with the new `expectedTotal` and the **same** `clientRequestId` (the rejected request created no order, so reuse is safe and still guards against double submission);
- `RESTAURANT_CLOSED`, `BELOW_MIN_ORDER` → message + back to cart;
- `UNAUTHORIZED` → sign-in with `returnTo=/checkout`.

## 7. Server-side tracking simulation

- Migration enables `pg_cron` and defines `advance_order_statuses()` (`security definer`, owned by `postgres`). For every order not in (`delivered`, `cancelled`, `failed`), it computes the target status from `now() - placed_at` using this schedule and updates only if the target is later in the sequence than the current status:

  | Elapsed since placed | Status |
  |---|---|
  | 0:00 | placed |
  | 0:30 | confirmed |
  | 1:30 | preparing |
  | 4:00 | ready |
  | 5:00 | picked_up |
  | 6:00 | out_for_delivery |
  | 8:00 | delivered |

- `cron.schedule('advance-orders', '30 seconds', 'select advance_order_statuses()')`.
- Trigger `orders_status_notify` (`after update of status on orders`, when status actually changed) inserts a `notifications` row with a status-specific title/body, e.g. "Out for delivery — Your order from Biryani Junction is on its way!". `cancel-order` updates fire the same trigger ("Order cancelled").

## 8. Seed data

`scripts/generate-seed-sql.ts` (run with `npx tsx`) reads the existing TypeScript seed arrays (`SEED_RESTAURANTS`, `SEED_CATEGORIES`, `SEED_MENU_ITEMS`, `SEED_OFFERS`, `SEED_COUPONS`) and writes `supabase/seed.sql` (idempotent `insert … on conflict (id) do update`). The TS seed files remain the single source of truth for the catalog; `seed.sql` is committed and regenerated whenever they change. A Jest test asserts `seed.sql` is up to date with the TS seed (regenerate-and-compare). `data/seed/addresses.ts` and `data/seed/orders.ts` are deleted. Valid seed coupons now expire 2027-12-31.

## 9. Repository layout (new/changed)

```
supabase/
  config.toml                          # functions: place-order, cancel-order (verify_jwt = false; verified in code)
  migrations/
    <ts>_catalog.sql                   # catalog tables + RLS
    <ts>_users.sql                     # profiles, addresses, favorites, profile trigger, set_default_address + RLS
    <ts>_orders.sql                    # orders, notifications, grants, RLS, realtime publication
    <ts>_tracking.sql                  # pg_cron, advance_order_statuses, notify trigger, schedule
    <ts>_search.sql                    # search_catalog()
  seed.sql                             # generated
  functions/
    _shared/{domain,pricing,coupons,mappers,order-errors,place-order-core}.ts
    _server/{http,clients}.ts            # Deno-only helpers
    place-order/index.ts
    cancel-order/index.ts
lib/supabase.ts
lib/secure-chunked-storage.ts
services/{offers,notifications,order-errors}.ts      # new
services/{auth,restaurants,search,coupons,addresses,favorites,orders}.ts   # rewritten internals
features/auth/requireSignIn.ts
hooks/{useRealtimeSync,useNotifications}.ts
scripts/{generate-seed-sql,verify-rls,smoke-test}.ts
.env.example
```

Removed: `store/notifications-store.ts`. Dev dependencies added: `supabase` (CLI), `tsx`.

## 10. Testing

**Jest (run by the implementer, must pass):**
- Existing 32 tests pass against the moved `_shared` modules.
- `place-order-core`: one test per error code; server-side option/add-on pricing ignores any client price; required-group enforcement; `PRICE_CHANGED` when `expectedTotal` differs; happy path produces the exact order row.
- `checkCoupon`: expired, wrong restaurant, below minimum, valid.
- `secure-chunked-storage`: round-trips a >2 KB value; `removeItem` clears all chunks (SecureStore mocked).
- `mappers`: snake_case rows ↔ domain objects.
- `services/orders` error mapping: each HTTP/code pair → `OrderError`.
- `seed.sql` freshness test.

**Against the hosted project (run by the owner, commands provided):**
- `scripts/verify-rls.ts` (needs `SUPABASE_SERVICE_ROLE_KEY` in git-ignored `.env.local`): creates two throwaway users via the admin API and asserts — user A cannot read B's orders/addresses/favorites/notifications; no client can insert/update `orders`; a user can only update `read_at` on notifications; `anon` can read the catalog and nothing else. Deletes the users afterwards.
- `scripts/smoke-test.ts` (after function deploy): normal order succeeds; same `clientRequestId` returns the same order id; closed restaurant → `RESTAURANT_CLOSED`; wrong `expectedTotal` → `PRICE_CHANGED`; cancel within `placed` succeeds; cancel after `delivered` → `NOT_CANCELLABLE` (uses a seeded delivered order created by the script via service role).

**Manual device checklist:** guest browse → gated checkout prompts sign-in → email code arrives → name prompt → back to checkout with cart intact → place order → tracking advances live without leaving the screen → notification badge increments → cancel an early order → reorder from history → sign out → second account sees none of the first account's data.

## 11. Owner setup steps (commands given in the plan; the owner runs them)

1. Create a free Supabase project; copy URL + anon key into `.env`.
2. `npx supabase login` → `npx supabase link --project-ref <ref>`.
3. `npx supabase db push --include-seed`.
4. `npx supabase functions deploy --use-api` (no Docker).
5. Dashboard: edit the Magic Link email template to include `{{ .Token }}`; optionally configure Brevo SMTP.

## 12. Git workflow

Work happens on the local branch `feature/backend`, committed task by task. Commit messages carry **no** Claude co-author trailers. Claude does **not** push; when the sub-project is done, the owner receives the push commands.

## 13. Definition of done

- `npx tsc --noEmit` and `npx jest` pass; `npx expo export --platform android` succeeds.
- `verify-rls` and `smoke-test` pass against the owner's hosted project.
- Manual device checklist completed.
- Payment and tracking remain visibly labeled as simulations; no "Dev OTP" UI remains.

## 14. Out of scope (later sub-projects)

- Real LLM assistant (Sub-project 3).
- Push notifications, loyalty points, restaurant/admin tooling (Sub-project 4).
- Real payment gateway, real SMS, cart sync across devices, preferences sync, order status history table.
