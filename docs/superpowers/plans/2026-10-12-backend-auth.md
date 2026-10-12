# AAHARAM Sub-project 2: Supabase Backend + Real Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AAHARAM's local-only data layer with a hosted Supabase backend: email-OTP sign-in, server-owned orders priced and validated by an Edge Function, RLS-protected user data, and server-driven order tracking delivered over Realtime.

**Architecture:** The Expo app reads the catalog and the user's own rows straight from Postgres through `supabase-js` (RLS enforces access). Trusted writes go through two Deno Edge Functions (`place-order`, `cancel-order`) that reuse the app's own pricing code from `supabase/functions/_shared/`. A pg_cron job advances order statuses every 30 s; a trigger writes notification rows; the app subscribes to both via Realtime.

**Tech Stack:** Expo SDK 57 / React Native 0.86, TypeScript 6, Expo Router, TanStack Query 5, Zustand 5, Zod 4, `@supabase/supabase-js` 2, Supabase CLI 2 (npm dev dependency), Deno Edge Functions, Postgres + pg_cron, Jest 30 (babel-preset-expo), `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-10-12-backend-auth-design.md`

## Global Constraints

- Portfolio project: free tiers only; payments stay an explicitly labeled simulation (`paid_simulated`, `pending_cod`, `refunded_simulated`); no real gateway.
- Brand name only via `constants/brand.ts`; colors only via `constants/theme.ts` tokens / NativeWind classes; INR display only via `formatCurrency`.
- Every simulated integration keeps a visible label (payment banner, tracking caption). No "Dev OTP" UI may remain.
- Every list screen keeps skeleton / empty / error states.
- No final payable total is computed inside a component for submission — the server (`place-order`) is authoritative; components compute a *preview* via the shared `calculateCartTotals` only.
- `supabase/functions/_shared/**` must be pure TypeScript: no imports outside `_shared`, relative imports use explicit `.ts` extensions (Deno requirement), no `Deno`, no npm imports.
- Deno-only helpers live in `supabase/functions/_server/**` (excluded from the app's `tsconfig`).
- Auth session persisted via SecureStore (chunked adapter). Cart, preferences, recent searches, onboarding flag, location label stay device-local.
- Git: work on the local branch `feature/backend`. Commit after every task. Commit messages carry **no** `Co-Authored-By` / Claude attribution lines. **Never push.**
- Never commit `.env` or `.env.local` (already git-ignored).
- Every task ends green: `npx tsc --noEmit` exits 0 and `npx jest` passes.

## Deviations from the spec (decided while planning)

1. Row ↔ domain mappers live in `supabase/functions/_shared/mappers.ts` (not `services/mappers.ts`) so the app, the Edge Functions, and the seed generator share one implementation.
2. Edge Functions use `verify_jwt = false` and verify the caller in code with `auth.getUser(token)`. This works with both legacy JWT keys and the newer `sb_publishable_…`/asymmetric keys, which the gateway's `verify_jwt` does not handle uniformly.
3. `data/seed/orders.ts` and `data/seed/addresses.ts` are deleted (their only consumers are the local services being replaced).
4. Valid seed coupons' `expiresAt` move to `2027-12-31` (several expired within weeks of today, 2026-10-12, which would break the demo).

The spec file is updated with these in Task 13.

---

## File Structure

```
supabase/
  config.toml                                   # Task 4  project id, seed path, function settings
  migrations/
    20261012000100_catalog.sql                  # Task 4  restaurants, menu_categories, menu_items, offers, coupons + RLS
    20261012000200_users.sql                    # Task 4  profiles (+signup trigger), addresses, set_default_address, favorites + RLS
    20261012000300_orders.sql                   # Task 4  orders, notifications, grants, RLS, realtime publication
    20261012000400_tracking.sql                 # Task 4  pg_cron, advance_order_statuses, notify trigger, schedule
    20261012000500_search.sql                   # Task 4  search_catalog(q)
  seed.sql                                      # Task 5  GENERATED from data/seed/*.ts
  functions/
    _shared/                                    # pure TS shared with the app (Jest-tested)
      domain.ts                                 # Task 1  (moved from types/domain.ts) domain types
      pricing.ts                                # Task 1  (moved from lib/pricing/calculate.ts)
      coupons.ts                                # Task 1  checkCoupon rules
      mappers.ts                                # Task 2  DB rows <-> domain objects
      order-errors.ts                           # Task 3  error codes, HTTP statuses
      place-order-core.ts                       # Task 3  validateAndPriceOrder, isCancellable
    _server/                                    # Deno-only helpers
      http.ts                                   # Task 6  CORS + JSON responses
      clients.ts                                # Task 6  service-role client, caller identification
    place-order/index.ts                        # Task 6
    cancel-order/index.ts                       # Task 6
types/domain.ts                                 # Task 1  re-export of _shared/domain.ts
lib/pricing/calculate.ts                        # Task 1  re-export of _shared/pricing.ts
lib/secure-chunked-storage.ts                   # Task 7
lib/supabase.ts                                 # Task 7
lib/legacy-cleanup.ts                           # Task 10
services/restaurants.ts, search.ts, coupons.ts  # Task 8  rewritten (Supabase)
services/offers.ts                              # Task 8  new
services/auth.ts                                # Task 9  rewritten (email OTP + local guest)
services/addresses.ts, favorites.ts, orders.ts  # Task 10 rewritten
services/order-errors.ts                        # Task 10 OrderError + toOrderError
services/notifications.ts                       # Task 11 new
features/auth/requireSignIn.ts                  # Task 9
hooks/useNotifications.ts, useRealtimeSync.ts   # Task 11
scripts/generate-seed-sql.ts                    # Task 5
scripts/script-env.ts, verify-rls.ts, smoke-test.ts   # Task 13
docs/backend-setup.md                           # Task 13 owner setup guide
.env.example, .env.local.example                # Task 7 / Task 13
```

Deleted: `store/notifications-store.ts` (Task 11), `data/seed/orders.ts`, `data/seed/addresses.ts` (Task 10), `tests/coupons.test.ts` (Task 8 — replaced by `tests/check-coupon.test.ts`).

---

### Task 1: Shared pure modules (domain, pricing, coupon rules)

**Files:**
- Move: `types/domain.ts` → `supabase/functions/_shared/domain.ts`
- Create: `types/domain.ts` (re-export)
- Move: `lib/pricing/calculate.ts` → `supabase/functions/_shared/pricing.ts`
- Create: `lib/pricing/calculate.ts` (re-export)
- Create: `supabase/functions/_shared/coupons.ts`
- Modify: `services/coupons.ts`
- Modify: `tsconfig.json`
- Test: `tests/check-coupon.test.ts`

**Interfaces:**
- Produces: `checkCoupon(coupon: Coupon, subtotal: number, restaurantId: string, now: Date): CouponCheck` where `type CouponCheck = { ok: true } | { ok: false; reason: string }`.
- Produces: all existing exports of `types/domain.ts` and `lib/pricing/calculate.ts` unchanged at their old import paths.

- [ ] **Step 1: Write the failing test** — `tests/check-coupon.test.ts`

```ts
import { checkCoupon } from "../supabase/functions/_shared/coupons";
import { Coupon } from "../types/domain";

const NOW = new Date("2026-10-12T12:00:00Z");

const base: Coupon = {
  code: "TEST20",
  description: "20% off up to ₹100",
  type: "percentage",
  value: 20,
  minOrderAmount: 299,
  maxDiscount: 100,
  restaurantId: "r1",
  expiresAt: "2026-12-31",
};

describe("checkCoupon", () => {
  it("accepts a valid coupon at its restaurant", () => {
    expect(checkCoupon(base, 500, "r1", NOW)).toEqual({ ok: true });
  });

  it("rejects an expired coupon", () => {
    expect(checkCoupon({ ...base, expiresAt: "2026-01-01" }, 500, "r1", NOW)).toEqual({
      ok: false,
      reason: "This coupon has expired",
    });
  });

  it("rejects a restaurant-specific coupon at another restaurant", () => {
    expect(checkCoupon(base, 500, "r2", NOW)).toEqual({
      ok: false,
      reason: "This coupon isn't valid at this restaurant",
    });
  });

  it("accepts a platform-wide coupon at any restaurant", () => {
    expect(checkCoupon({ ...base, restaurantId: undefined }, 500, "r7", NOW)).toEqual({ ok: true });
  });

  it("rejects when the subtotal is below the coupon minimum and states the shortfall", () => {
    expect(checkCoupon(base, 200, "r1", NOW)).toEqual({
      ok: false,
      reason: "Add items worth ₹99 more to use this coupon",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/check-coupon.test.ts`
Expected: FAIL — `Cannot find module '../supabase/functions/_shared/coupons'`.

- [ ] **Step 3: Move the domain types and pricing module**

```bash
mkdir -p supabase/functions/_shared
git mv types/domain.ts supabase/functions/_shared/domain.ts
git mv lib/pricing/calculate.ts supabase/functions/_shared/pricing.ts
```

In `supabase/functions/_shared/pricing.ts`, replace the first line:

```ts
import { CartCustomization, CartLineItem, Coupon, MenuItem, Restaurant } from "../../types/domain";
```

with:

```ts
import type { CartCustomization, CartLineItem, Coupon, MenuItem, Restaurant } from "./domain.ts";
```

In `supabase/functions/_shared/domain.ts`, replace the first line `// types/domain.ts` with:

```ts
// Domain types shared by the Expo app (via types/domain.ts) and the Supabase Edge Functions.
// Pure TypeScript only: no imports outside supabase/functions/_shared.
```

- [ ] **Step 4: Re-export from the old paths**

Create `types/domain.ts`:

```ts
export * from "../supabase/functions/_shared/domain";
```

Create `lib/pricing/calculate.ts`:

```ts
export * from "../../supabase/functions/_shared/pricing";
```

- [ ] **Step 5: Implement `supabase/functions/_shared/coupons.ts`**

```ts
import type { Coupon } from "./domain.ts";

export type CouponCheck = { ok: true } | { ok: false; reason: string };

// Coupon eligibility rules, shared by the cart preview (services/coupons.ts) and the
// authoritative re-check inside the place-order Edge Function. `now` is injected so the
// rules are deterministic in tests and identical on both sides.
export function checkCoupon(coupon: Coupon, subtotal: number, restaurantId: string, now: Date): CouponCheck {
  if (new Date(coupon.expiresAt).getTime() < now.getTime()) {
    return { ok: false, reason: "This coupon has expired" };
  }
  if (coupon.restaurantId && coupon.restaurantId !== restaurantId) {
    return { ok: false, reason: "This coupon isn't valid at this restaurant" };
  }
  if (subtotal < coupon.minOrderAmount) {
    return { ok: false, reason: `Add items worth ₹${coupon.minOrderAmount - subtotal} more to use this coupon` };
  }
  return { ok: true };
}
```

- [ ] **Step 6: Make `services/coupons.ts` use the shared rules** — replace the whole file:

```ts
import { SEED_COUPONS } from "../data/seed/offers";
import { checkCoupon } from "../supabase/functions/_shared/coupons";
import { Coupon } from "../types/domain";

export type CouponValidationResult = { ok: true; coupon: Coupon } | { ok: false; reason: string };

export async function validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<CouponValidationResult> {
  const coupon = SEED_COUPONS.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (!coupon) return { ok: false, reason: "Invalid coupon code" };
  const check = checkCoupon(coupon, subtotal, restaurantId, new Date());
  return check.ok ? { ok: true, coupon } : check;
}
```

- [ ] **Step 7: Let the app typecheck `.ts`-extension imports and skip Deno-only files** — replace `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowImportingTsExtensions": true,
    "types": ["jest", "node"]
  },
  "exclude": [
    "node_modules",
    "babel.config.js",
    "metro.config.js",
    "jest.config.js",
    "android",
    "ios",
    "supabase/functions/*/index.ts",
    "supabase/functions/_server"
  ]
}
```

(`allowImportingTsExtensions` is valid because `expo/tsconfig.base` sets `noEmit: true`. The base's `exclude` is replaced by this list, so its entries are repeated here.)

- [ ] **Step 8: Run all checks**

Run: `npx jest`
Expected: all suites pass, including the 5 new `checkCoupon` tests (37 tests total).

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx expo export --platform android --output-dir "$TEMP/aaharam-export"` (PowerShell: `--output-dir "$env:TEMP\aaharam-export"`)
Expected: completes; proves Metro resolves the moved files and their `.ts`-extension imports.

- [ ] **Step 9: Commit**

```bash
git add -A supabase/functions/_shared types/domain.ts lib/pricing/calculate.ts services/coupons.ts tsconfig.json tests/check-coupon.test.ts
git commit -m "refactor: move domain types, pricing and coupon rules into supabase/functions/_shared"
```

---

### Task 2: Row ↔ domain mappers

**Files:**
- Create: `supabase/functions/_shared/mappers.ts`
- Test: `tests/mappers.test.ts`

**Interfaces:**
- Consumes: domain types from `./domain.ts`.
- Produces (exact names used by Tasks 5, 6, 8, 10):
  - Row types: `RestaurantRow`, `MenuCategoryRow`, `MenuItemRow`, `OfferRow`, `CouponRow`, `AddressRow`, `AddressWrite`.
  - `restaurantFromRow`, `restaurantToRow`, `menuCategoryFromRow`, `menuCategoryToRow`, `menuItemFromRow`, `menuItemToRow`, `offerFromRow`, `offerToRow`, `couponFromRow`, `couponToRow`, `addressFromRow`, `addressToWrite`.

- [ ] **Step 1: Write the failing test** — `tests/mappers.test.ts`

```ts
import {
  restaurantFromRow, restaurantToRow,
  menuCategoryFromRow, menuCategoryToRow,
  menuItemFromRow, menuItemToRow,
  offerFromRow, offerToRow,
  couponFromRow, couponToRow,
  addressFromRow, addressToWrite, AddressRow,
} from "../supabase/functions/_shared/mappers";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_CATEGORIES } from "../data/seed/categories";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_OFFERS, SEED_COUPONS } from "../data/seed/offers";

describe("catalog mappers round-trip the seed data", () => {
  it("restaurants", () => {
    for (const r of SEED_RESTAURANTS) expect(restaurantFromRow(restaurantToRow(r))).toEqual(r);
  });
  it("menu categories", () => {
    for (const c of SEED_CATEGORIES) expect(menuCategoryFromRow(menuCategoryToRow(c))).toEqual(c);
  });
  it("menu items", () => {
    for (const m of SEED_MENU_ITEMS) expect(menuItemFromRow(menuItemToRow(m))).toEqual(m);
  });
  it("offers", () => {
    for (const o of SEED_OFFERS) expect(offerFromRow(offerToRow(o))).toEqual(o);
  });
  it("coupons", () => {
    for (const c of SEED_COUPONS) expect(couponFromRow(couponToRow(c))).toEqual(c);
  });
});

describe("row-specific conversions", () => {
  it("parses numeric ratings that PostgREST returns as strings", () => {
    const row = { ...restaurantToRow(SEED_RESTAURANTS[0]), rating: "4.5" };
    expect(restaurantFromRow(row).rating).toBe(4.5);
  });

  it("writes optional fields as SQL nulls, never undefined", () => {
    const row = menuItemToRow({ ...SEED_MENU_ITEMS[0], rating: undefined, popular: undefined });
    expect(row.rating).toBeNull();
    expect(row.popular).toBe(false);
  });

  it("maps an address row to the domain shape and back to a write payload", () => {
    const row: AddressRow = {
      id: "6f1c1d1e-0000-4000-8000-000000000001",
      user_id: "6f1c1d1e-0000-4000-8000-0000000000aa",
      label: "Home",
      recipient_name: "Asha Rao",
      phone: "9876543210",
      line1: "12 MG Road",
      area: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560038",
      landmark: null,
      instructions: "Ring twice",
      is_default: true,
      lat: null,
      lng: null,
    };
    const address = addressFromRow(row);
    expect(address).toEqual({
      id: row.id,
      label: "Home",
      recipientName: "Asha Rao",
      phone: "9876543210",
      line1: "12 MG Road",
      area: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560038",
      instructions: "Ring twice",
      isDefault: true,
    });
    expect(addressToWrite(address)).toEqual({
      label: "Home",
      recipient_name: "Asha Rao",
      phone: "9876543210",
      line1: "12 MG Road",
      area: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560038",
      landmark: null,
      instructions: "Ring twice",
      lat: null,
      lng: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/mappers.test.ts`
Expected: FAIL — `Cannot find module '../supabase/functions/_shared/mappers'`.

- [ ] **Step 3: Implement `supabase/functions/_shared/mappers.ts`**

```ts
// Conversions between Postgres rows (snake_case, SQL nulls) and the app's domain objects
// (camelCase, optional fields). Shared by the app's services, the Edge Functions and the
// seed generator so the three can never disagree about a column.
import type {
  AddOn, Address, Coupon, ItemOptionGroup, MenuCategory, MenuItem, Offer, Restaurant, VegFlag,
} from "./domain.ts";

export interface RestaurantRow {
  id: string;
  name: string;
  phone: string | null;
  cuisines: string[];
  cover_image_url: string;
  rating: number | string;
  rating_count: number;
  price_range: number;
  eta_minutes: number;
  delivery_fee: number;
  min_order_amount: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
  offer_ids: string[];
  tags: string[];
}

export interface MenuCategoryRow {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItemRow {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string;
  base_price: number;
  veg_flag: VegFlag;
  rating: number | string | null;
  is_available: boolean;
  option_groups: ItemOptionGroup[];
  add_ons: AddOn[];
  supports_spice_level: boolean;
  popular: boolean;
}

export interface OfferRow {
  id: string;
  restaurant_id: string | null;
  title: string;
  description: string;
  coupon_code: string | null;
}

export interface CouponRow {
  code: string;
  description: string;
  type: Coupon["type"];
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  restaurant_id: string | null;
  expires_at: string;
}

export interface AddressRow {
  id: string;
  user_id: string;
  label: Address["label"];
  recipient_name: string;
  phone: string;
  line1: string;
  area: string;
  city: string;
  state: string;
  postal_code: string;
  landmark: string | null;
  instructions: string | null;
  is_default: boolean;
  lat: number | null;
  lng: number | null;
}

/** Columns a client may write on `addresses` (id, user_id and is_default are managed separately). */
export type AddressWrite = Omit<AddressRow, "id" | "user_id" | "is_default">;

export function restaurantFromRow(r: RestaurantRow): Restaurant {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? undefined,
    cuisines: r.cuisines,
    coverImageUrl: r.cover_image_url,
    rating: Number(r.rating),
    ratingCount: r.rating_count,
    priceRange: r.price_range as Restaurant["priceRange"],
    etaMinutes: r.eta_minutes,
    deliveryFee: r.delivery_fee,
    minOrderAmount: r.min_order_amount,
    isOpen: r.is_open,
    operatingHours: { opensAt: r.opens_at, closesAt: r.closes_at },
    offerIds: r.offer_ids,
    tags: r.tags,
  };
}

export function restaurantToRow(r: Restaurant): RestaurantRow {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? null,
    cuisines: r.cuisines,
    cover_image_url: r.coverImageUrl,
    rating: r.rating,
    rating_count: r.ratingCount,
    price_range: r.priceRange,
    eta_minutes: r.etaMinutes,
    delivery_fee: r.deliveryFee,
    min_order_amount: r.minOrderAmount,
    is_open: r.isOpen,
    opens_at: r.operatingHours.opensAt,
    closes_at: r.operatingHours.closesAt,
    offer_ids: r.offerIds,
    tags: r.tags,
  };
}

export function menuCategoryFromRow(c: MenuCategoryRow): MenuCategory {
  return { id: c.id, restaurantId: c.restaurant_id, name: c.name, sortOrder: c.sort_order };
}

export function menuCategoryToRow(c: MenuCategory): MenuCategoryRow {
  return { id: c.id, restaurant_id: c.restaurantId, name: c.name, sort_order: c.sortOrder };
}

export function menuItemFromRow(m: MenuItemRow): MenuItem {
  return {
    id: m.id,
    restaurantId: m.restaurant_id,
    categoryId: m.category_id,
    name: m.name,
    description: m.description,
    imageUrl: m.image_url,
    basePrice: m.base_price,
    vegFlag: m.veg_flag,
    rating: m.rating === null ? undefined : Number(m.rating),
    isAvailable: m.is_available,
    optionGroups: m.option_groups,
    addOns: m.add_ons,
    supportsSpiceLevel: m.supports_spice_level,
    popular: m.popular ? true : undefined,
  };
}

export function menuItemToRow(m: MenuItem): MenuItemRow {
  return {
    id: m.id,
    restaurant_id: m.restaurantId,
    category_id: m.categoryId,
    name: m.name,
    description: m.description,
    image_url: m.imageUrl,
    base_price: m.basePrice,
    veg_flag: m.vegFlag,
    rating: m.rating ?? null,
    is_available: m.isAvailable,
    option_groups: m.optionGroups,
    add_ons: m.addOns,
    supports_spice_level: m.supportsSpiceLevel,
    popular: m.popular ?? false,
  };
}

export function offerFromRow(o: OfferRow): Offer {
  return {
    id: o.id,
    restaurantId: o.restaurant_id ?? undefined,
    title: o.title,
    description: o.description,
    couponCode: o.coupon_code ?? undefined,
  };
}

export function offerToRow(o: Offer): OfferRow {
  return {
    id: o.id,
    restaurant_id: o.restaurantId ?? null,
    title: o.title,
    description: o.description,
    coupon_code: o.couponCode ?? null,
  };
}

export function couponFromRow(c: CouponRow): Coupon {
  return {
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    minOrderAmount: c.min_order_amount,
    maxDiscount: c.max_discount ?? undefined,
    restaurantId: c.restaurant_id ?? undefined,
    expiresAt: c.expires_at,
  };
}

export function couponToRow(c: Coupon): CouponRow {
  return {
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    min_order_amount: c.minOrderAmount,
    max_discount: c.maxDiscount ?? null,
    restaurant_id: c.restaurantId ?? null,
    expires_at: c.expiresAt,
  };
}

export function addressFromRow(a: AddressRow): Address {
  return {
    id: a.id,
    label: a.label,
    recipientName: a.recipient_name,
    phone: a.phone,
    line1: a.line1,
    area: a.area,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    landmark: a.landmark ?? undefined,
    instructions: a.instructions ?? undefined,
    isDefault: a.is_default,
    lat: a.lat ?? undefined,
    lng: a.lng ?? undefined,
  };
}

export function addressToWrite(a: Address): AddressWrite {
  return {
    label: a.label,
    recipient_name: a.recipientName,
    phone: a.phone,
    line1: a.line1,
    area: a.area,
    city: a.city,
    state: a.state,
    postal_code: a.postalCode,
    landmark: a.landmark ?? null,
    instructions: a.instructions ?? null,
    lat: a.lat ?? null,
    lng: a.lng ?? null,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/mappers.test.ts`
Expected: PASS (8 tests). Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/mappers.ts tests/mappers.test.ts
git commit -m "feat: add shared row-to-domain mappers for the Supabase schema"
```

---

### Task 3: Order validation & pricing core

**Files:**
- Modify: `supabase/functions/_shared/domain.ts` (add `PaymentStatus`)
- Create: `supabase/functions/_shared/order-errors.ts`
- Create: `supabase/functions/_shared/place-order-core.ts`
- Test: `tests/place-order-core.test.ts`

**Interfaces:**
- Consumes: `calculateLineItemPrice`, `calculateCartTotals`, `CartTotals` (pricing.ts); `checkCoupon` (coupons.ts).
- Produces:
  - `type PaymentStatus = "paid_simulated" | "pending_cod" | "refunded_simulated"` (domain.ts)
  - `type OrderErrorCode`, `interface OrderErrorBody { code; message; details? }`, `ORDER_ERROR_STATUS: Record<OrderErrorCode, number>`, `isOrderErrorCode(value: unknown): value is OrderErrorCode` (order-errors.ts)
  - `interface PlaceOrderLineInput { menuItemId: string; quantity: number; customization: CartCustomization }`
  - `interface PlaceOrderInput { clientRequestId: string; restaurantId: string; lines: PlaceOrderLineInput[]; couponCode?: string | null; addressId: string; paymentMethod: PaymentMethod; deliveryInstructions?: string | null; expectedTotal: number }`
  - `interface PlaceOrderCatalog { restaurant: Restaurant | null; menuItems: MenuItem[]; coupon: Coupon | null; address: Address | null }`
  - `interface NewOrderRow` (snake_case insert payload for `public.orders`)
  - `validateAndPriceOrder(input, catalog, userId: string, now: Date): PlaceOrderResult` where `PlaceOrderResult = { ok: true; row: NewOrderRow; totals: CartTotals } | { ok: false; error: OrderErrorBody }`
  - `CANCELLABLE_STATUSES: OrderStatus[]` (`["placed","confirmed"]`) and `isCancellable(status: OrderStatus): boolean`

- [ ] **Step 1: Write the failing test** — `tests/place-order-core.test.ts`

```ts
import {
  validateAndPriceOrder, isCancellable, PlaceOrderInput, PlaceOrderCatalog,
} from "../supabase/functions/_shared/place-order-core";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_COUPONS } from "../data/seed/offers";
import { Address } from "../types/domain";

const NOW = new Date("2026-10-12T12:00:00Z");
const USER = "6f1c1d1e-0000-4000-8000-0000000000aa";

const r1 = SEED_RESTAURANTS.find((r) => r.id === "r1")!; // open, deliveryFee 29, min 99, eta 35
const r11 = SEED_RESTAURANTS.find((r) => r.id === "r11")!; // closed
const m1 = SEED_MENU_ITEMS.find((i) => i.id === "m1")!; // Paneer Biryani 220, og1 required (opt1 +0, opt2 +60), a1 +40, a2 +25
const m2 = SEED_MENU_ITEMS.find((i) => i.id === "m2")!;
const m17 = SEED_MENU_ITEMS.find((i) => i.id === "m17")!; // r4, isAvailable false
const m45 = SEED_MENU_ITEMS.find((i) => i.id === "m45")!; // r11
const otherRestaurantItem = SEED_MENU_ITEMS.find((i) => i.restaurantId === "r2" && i.isAvailable)!;
const BIRYANI20 = SEED_COUPONS.find((c) => c.code === "BIRYANI20")!;
const PIZZA15 = SEED_COUPONS.find((c) => c.code === "PIZZA15")!;

const address: Address = {
  id: "6f1c1d1e-0000-4000-8000-000000000001",
  label: "Home",
  recipientName: "Asha Rao",
  phone: "9876543210",
  line1: "12 MG Road",
  area: "Indiranagar",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560038",
  isDefault: true,
};

function input(overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    clientRequestId: "req-1700000000000-abc123",
    restaurantId: "r1",
    lines: [{ menuItemId: "m1", quantity: 2, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
    couponCode: null,
    addressId: address.id,
    paymentMethod: "upi",
    deliveryInstructions: null,
    expectedTotal: 491, // 440 subtotal + 29 delivery + 22 tax
    ...overrides,
  };
}

function catalog(overrides: Partial<PlaceOrderCatalog> = {}): PlaceOrderCatalog {
  return { restaurant: r1, menuItems: [m1, m2], coupon: null, address, ...overrides };
}

function expectError(result: ReturnType<typeof validateAndPriceOrder>, code: string) {
  if (result.ok) throw new Error(`expected ${code}, got ok`);
  expect(result.error.code).toBe(code);
  return result.error;
}

describe("validateAndPriceOrder — success", () => {
  it("builds the order row with server-computed totals", () => {
    const result = validateAndPriceOrder(input(), catalog(), USER, NOW);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row).toEqual({
      user_id: USER,
      client_request_id: "req-1700000000000-abc123",
      restaurant_id: "r1",
      restaurant_name: "Biryani Junction",
      items: [{ menuItemId: "m1", name: "Paneer Biryani", quantity: 2, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
      address,
      delivery_instructions: null,
      payment_method: "upi",
      payment_status: "paid_simulated",
      status: "placed",
      subtotal: 440,
      discount: 0,
      delivery_fee: 29,
      tax: 22,
      total: 491,
      coupon_code: null,
      eta_minutes: 35,
    });
  });

  it("marks cash-on-delivery orders as pending_cod", () => {
    const result = validateAndPriceOrder(input({ paymentMethod: "cod" }), catalog(), USER, NOW);
    expect(result.ok && result.row.payment_status).toBe("pending_cod");
  });

  it("prices options and add-ons on the server", () => {
    const result = validateAndPriceOrder(
      input({
        lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "opt2" }, addOnIds: ["a1"] } }],
        expectedTotal: 365, // 320 + 29 + 16
      }),
      catalog(),
      USER,
      NOW
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row.items[0].unitPrice).toBe(320);
    expect(result.row.total).toBe(365);
  });

  it("applies a valid coupon", () => {
    const result = validateAndPriceOrder(
      input({ couponCode: "BIRYANI20", expectedTotal: 399 }), // 440 - 88 + 29 + 18
      catalog({ coupon: BIRYANI20 }),
      USER,
      NOW
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row.discount).toBe(88);
    expect(result.row.coupon_code).toBe("BIRYANI20");
    expect(result.row.total).toBe(399);
  });

  it("trims delivery instructions and stores blank ones as null", () => {
    const withNote = validateAndPriceOrder(input({ deliveryInstructions: "  Leave at door  " }), catalog(), USER, NOW);
    const blank = validateAndPriceOrder(input({ deliveryInstructions: "   " }), catalog(), USER, NOW);
    expect(withNote.ok && withNote.row.delivery_instructions).toBe("Leave at door");
    expect(blank.ok && blank.row.delivery_instructions).toBeNull();
  });
});

describe("validateAndPriceOrder — rejections", () => {
  it("NOT_FOUND when the restaurant is missing", () => {
    expectError(validateAndPriceOrder(input(), catalog({ restaurant: null }), USER, NOW), "NOT_FOUND");
  });

  it("RESTAURANT_CLOSED when the restaurant is closed", () => {
    const result = validateAndPriceOrder(
      input({ restaurantId: "r11", lines: [{ menuItemId: "m45", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } }] }),
      catalog({ restaurant: r11, menuItems: [m45] }),
      USER,
      NOW
    );
    expectError(result, "RESTAURANT_CLOSED");
  });

  it("NOT_FOUND when the address is missing or not the caller's", () => {
    const error = expectError(validateAndPriceOrder(input(), catalog({ address: null }), USER, NOW), "NOT_FOUND");
    expect(error.message).toBe("Delivery address not found");
  });

  it("INVALID_INPUT for an empty cart", () => {
    expectError(validateAndPriceOrder(input({ lines: [] }), catalog(), USER, NOW), "INVALID_INPUT");
  });

  it("ITEM_UNAVAILABLE lists unavailable, foreign and unknown items", () => {
    const result = validateAndPriceOrder(
      input({
        lines: [
          { menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } },
          { menuItemId: "m17", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } },
          { menuItemId: otherRestaurantItem.id, quantity: 1, customization: { optionSelections: {}, addOnIds: [] } },
          { menuItemId: "does-not-exist", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } },
        ],
      }),
      catalog({ menuItems: [m1, m17, otherRestaurantItem] }),
      USER,
      NOW
    );
    const error = expectError(result, "ITEM_UNAVAILABLE");
    expect(error.details).toEqual({ menuItemIds: ["m17", otherRestaurantItem.id, "does-not-exist"] });
  });

  it("INVALID_INPUT when a required option group has no selection", () => {
    const error = expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: {}, addOnIds: [] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
    expect(error.message).toBe("Choose a size for Paneer Biryani");
  });

  it("INVALID_INPUT for an unknown option id", () => {
    expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "nope" }, addOnIds: [] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
  });

  it("INVALID_INPUT for an unknown add-on id", () => {
    expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 1, customization: { optionSelections: { og1: "opt1" }, addOnIds: ["zzz"] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
  });

  it("INVALID_INPUT for a non-positive quantity", () => {
    expectError(
      validateAndPriceOrder(input({ lines: [{ menuItemId: "m1", quantity: 0, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }] }), catalog(), USER, NOW),
      "INVALID_INPUT"
    );
  });

  it("COUPON_INVALID for an unknown code", () => {
    const error = expectError(validateAndPriceOrder(input({ couponCode: "NOTREAL" }), catalog({ coupon: null }), USER, NOW), "COUPON_INVALID");
    expect(error.details).toEqual({ reason: "Invalid coupon code" });
  });

  it("COUPON_INVALID for a coupon from another restaurant", () => {
    const error = expectError(validateAndPriceOrder(input({ couponCode: "PIZZA15" }), catalog({ coupon: PIZZA15 }), USER, NOW), "COUPON_INVALID");
    expect(error.details).toEqual({ reason: "This coupon isn't valid at this restaurant" });
  });

  it("BELOW_MIN_ORDER reports the shortfall", () => {
    const error = expectError(
      validateAndPriceOrder(input(), catalog({ restaurant: { ...r1, minOrderAmount: 1000 } }), USER, NOW),
      "BELOW_MIN_ORDER"
    );
    expect(error.details).toEqual({ shortfall: 560 });
  });

  it("PRICE_CHANGED returns the server totals when expectedTotal differs", () => {
    const error = expectError(validateAndPriceOrder(input({ expectedTotal: 400 }), catalog(), USER, NOW), "PRICE_CHANGED");
    expect((error.details as { totals: { total: number } }).totals.total).toBe(491);
  });
});

describe("isCancellable", () => {
  it("allows cancelling only placed and confirmed orders", () => {
    expect(isCancellable("placed")).toBe(true);
    expect(isCancellable("confirmed")).toBe(true);
    expect(isCancellable("preparing")).toBe(false);
    expect(isCancellable("delivered")).toBe(false);
    expect(isCancellable("cancelled")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/place-order-core.test.ts`
Expected: FAIL — `Cannot find module '../supabase/functions/_shared/place-order-core'`.

- [ ] **Step 3: Add `PaymentStatus` to `supabase/functions/_shared/domain.ts`** — insert directly below the `export type PaymentMethod = ...` line:

```ts
export type PaymentStatus = "paid_simulated" | "pending_cod" | "refunded_simulated";
```

- [ ] **Step 4: Implement `supabase/functions/_shared/order-errors.ts`**

```ts
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
```

- [ ] **Step 5: Implement `supabase/functions/_shared/place-order-core.ts`**

```ts
// The authoritative order checks, as a pure function. The place-order Edge Function fetches
// the rows, calls this, and inserts `row` on success; Jest tests call it directly.
import type {
  Address, CartCustomization, CartLineItem, Coupon, MenuItem, OrderItem, OrderStatus, PaymentMethod,
  PaymentStatus, Restaurant,
} from "./domain.ts";
import { calculateCartTotals, calculateLineItemPrice, type CartTotals } from "./pricing.ts";
import { checkCoupon } from "./coupons.ts";
import type { OrderErrorBody, OrderErrorCode } from "./order-errors.ts";

export interface PlaceOrderLineInput {
  menuItemId: string;
  quantity: number;
  customization: CartCustomization;
}

export interface PlaceOrderInput {
  clientRequestId: string;
  restaurantId: string;
  lines: PlaceOrderLineInput[];
  couponCode?: string | null;
  addressId: string;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string | null;
  /** The total the user saw on screen; a mismatch yields PRICE_CHANGED instead of an order. */
  expectedTotal: number;
}

export interface PlaceOrderCatalog {
  restaurant: Restaurant | null;
  /** The menu items referenced by `input.lines` (missing ones are simply absent). */
  menuItems: MenuItem[];
  /** The coupon row for `input.couponCode`, or null when no code was sent or none matched. */
  coupon: Coupon | null;
  /** The address row for `input.addressId`, already filtered to the caller. */
  address: Address | null;
}

export interface NewOrderRow {
  user_id: string;
  client_request_id: string;
  restaurant_id: string;
  restaurant_name: string;
  items: OrderItem[];
  address: Address;
  delivery_instructions: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: "placed";
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  eta_minutes: number;
}

export type PlaceOrderResult = { ok: true; row: NewOrderRow; totals: CartTotals } | { ok: false; error: OrderErrorBody };

export const CANCELLABLE_STATUSES: OrderStatus[] = ["placed", "confirmed"];

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

function fail(code: OrderErrorCode, message: string, details?: Record<string, unknown>): PlaceOrderResult {
  return { ok: false, error: details ? { code, message, details } : { code, message } };
}

function customizationProblem(item: MenuItem, customization: CartCustomization): string | null {
  for (const [groupId, optionId] of Object.entries(customization.optionSelections)) {
    const group = item.optionGroups.find((g) => g.id === groupId);
    if (!group || !group.options.some((o) => o.id === optionId)) return `Invalid option selected for ${item.name}`;
  }
  for (const group of item.optionGroups) {
    if (group.required && !customization.optionSelections[group.id]) {
      return `Choose a ${group.name.toLowerCase()} for ${item.name}`;
    }
  }
  for (const addOnId of customization.addOnIds) {
    if (!item.addOns.some((a) => a.id === addOnId)) return `Invalid add-on selected for ${item.name}`;
  }
  return null;
}

export function validateAndPriceOrder(
  input: PlaceOrderInput,
  catalog: PlaceOrderCatalog,
  userId: string,
  now: Date
): PlaceOrderResult {
  const { restaurant, address } = catalog;
  if (!restaurant) return fail("NOT_FOUND", "Restaurant not found");
  if (!restaurant.isOpen) return fail("RESTAURANT_CLOSED", `${restaurant.name} is currently closed and cannot accept orders.`);
  if (!address) return fail("NOT_FOUND", "Delivery address not found");
  if (input.lines.length === 0) return fail("INVALID_INPUT", "Your cart is empty");

  const unavailable = input.lines
    .filter((line) => {
      const item = catalog.menuItems.find((m) => m.id === line.menuItemId);
      return !item || item.restaurantId !== restaurant.id || !item.isAvailable;
    })
    .map((line) => line.menuItemId);
  if (unavailable.length > 0) {
    return fail("ITEM_UNAVAILABLE", "Some items in your cart are no longer available", { menuItemIds: unavailable });
  }

  const serverLines: CartLineItem[] = [];
  const orderItems: OrderItem[] = [];
  for (const [index, line] of input.lines.entries()) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) return fail("INVALID_INPUT", "Quantity must be at least 1");
    const item = catalog.menuItems.find((m) => m.id === line.menuItemId)!;
    const problem = customizationProblem(item, line.customization);
    if (problem) return fail("INVALID_INPUT", problem);
    // Never trust a client price: unit prices come only from the menu row + selected options.
    const unitPrice = calculateLineItemPrice(item, line.customization);
    serverLines.push({
      lineId: `line-${index}`,
      menuItemId: item.id,
      restaurantId: item.restaurantId,
      quantity: line.quantity,
      customization: line.customization,
      unitPrice,
    });
    orderItems.push({ menuItemId: item.id, name: item.name, quantity: line.quantity, unitPrice, customization: line.customization });
  }

  const { subtotal } = calculateCartTotals(serverLines, catalog.menuItems, restaurant, null);

  let coupon: Coupon | null = null;
  if (input.couponCode) {
    if (!catalog.coupon) return fail("COUPON_INVALID", "Invalid coupon code", { reason: "Invalid coupon code" });
    const check = checkCoupon(catalog.coupon, subtotal, restaurant.id, now);
    if (!check.ok) return fail("COUPON_INVALID", check.reason, { reason: check.reason });
    coupon = catalog.coupon;
  }

  if (subtotal < restaurant.minOrderAmount) {
    const shortfall = restaurant.minOrderAmount - subtotal;
    return fail("BELOW_MIN_ORDER", `Add items worth ₹${shortfall} more to place this order`, { shortfall });
  }

  const totals = calculateCartTotals(serverLines, catalog.menuItems, restaurant, coupon);
  if (totals.total !== input.expectedTotal) {
    return fail("PRICE_CHANGED", "Prices have changed since you reviewed your order", { totals });
  }

  return {
    ok: true,
    totals,
    row: {
      user_id: userId,
      client_request_id: input.clientRequestId,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      items: orderItems,
      address,
      delivery_instructions: input.deliveryInstructions?.trim() || null,
      payment_method: input.paymentMethod,
      payment_status: input.paymentMethod === "cod" ? "pending_cod" : "paid_simulated",
      status: "placed",
      subtotal: totals.subtotal,
      discount: totals.discount,
      delivery_fee: totals.deliveryFee,
      tax: totals.tax,
      total: totals.total,
      coupon_code: coupon?.code ?? null,
      eta_minutes: restaurant.etaMinutes,
    },
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npx jest tests/place-order-core.test.ts`
Expected: PASS (20 tests). Then `npx jest` (all pass) and `npx tsc --noEmit` (exit 0).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared tests/place-order-core.test.ts
git commit -m "feat: add pure order validation and pricing core shared with the place-order function"
```

---

### Task 4: Supabase project config and database migrations

**Files:**
- Modify: `package.json` / `package-lock.json` (dev deps `supabase`, `tsx`)
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20261012000100_catalog.sql`
- Create: `supabase/migrations/20261012000200_users.sql`
- Create: `supabase/migrations/20261012000300_orders.sql`
- Create: `supabase/migrations/20261012000400_tracking.sql`
- Create: `supabase/migrations/20261012000500_search.sql`

**Interfaces:**
- Produces (used by Tasks 6, 8, 10, 11, 13): tables `restaurants`, `menu_categories`, `menu_items`, `offers`, `coupons`, `profiles`, `addresses`, `favorites`, `orders`, `notifications` with the columns in the mappers (Task 2) and `NewOrderRow` (Task 3); SQL functions `set_default_address(address_id uuid)`, `search_catalog(q text) returns jsonb`, `advance_order_statuses() returns integer`; Realtime publication on `orders`, `notifications`.

There is no local database (owner chose hosted, no Docker), so these migrations are verified against the hosted project in Task 13 (`db push`, `verify-rls`, `smoke-test`). Write them exactly as below.

- [ ] **Step 1: Install CLI tooling as dev dependencies**

Run: `npm install --save-dev supabase tsx`
Expected: both appear under `devDependencies`; `npx supabase --version` prints a 2.x version.

- [ ] **Step 2: Create `supabase/config.toml`**

```toml
# Supabase CLI config for the hosted AAHARAM project. Only settings this project relies on
# are listed; the CLI fills in defaults for everything else.
project_id = "aaharam"

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]

# Both functions verify the caller themselves with auth.getUser(token), which works with
# legacy JWT keys and the newer publishable/secret keys alike.
[functions.place-order]
verify_jwt = false

[functions.cancel-order]
verify_jwt = false
```

- [ ] **Step 3: Create `supabase/migrations/20261012000100_catalog.sql`**

```sql
-- Catalog: readable by everyone, writable by nobody through the API.

create table public.restaurants (
  id text primary key,
  name text not null,
  phone text,
  cuisines text[] not null default '{}',
  cover_image_url text not null,
  rating numeric(2,1) not null default 0,
  rating_count integer not null default 0,
  price_range smallint not null check (price_range between 1 and 3),
  eta_minutes integer not null,
  delivery_fee integer not null default 0,
  min_order_amount integer not null default 0,
  is_open boolean not null default true,
  opens_at text not null,
  closes_at text not null,
  offer_ids text[] not null default '{}',
  tags text[] not null default '{}'
);

create table public.menu_categories (
  id text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
create index menu_categories_restaurant_id_idx on public.menu_categories(restaurant_id);

create table public.menu_items (
  id text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  category_id text not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_url text not null,
  base_price integer not null check (base_price >= 0),
  veg_flag text not null check (veg_flag in ('veg', 'non-veg', 'egg', 'unknown')),
  rating numeric(2,1),
  is_available boolean not null default true,
  option_groups jsonb not null default '[]',
  add_ons jsonb not null default '[]',
  supports_spice_level boolean not null default false,
  popular boolean not null default false
);
create index menu_items_restaurant_id_idx on public.menu_items(restaurant_id);

create table public.offers (
  id text primary key,
  restaurant_id text references public.restaurants(id) on delete cascade,
  title text not null,
  description text not null,
  coupon_code text
);

create table public.coupons (
  code text primary key check (code = upper(code)),
  description text not null,
  type text not null check (type in ('percentage', 'fixed', 'free-delivery')),
  value integer not null default 0,
  min_order_amount integer not null default 0,
  max_discount integer,
  restaurant_id text references public.restaurants(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.offers enable row level security;
alter table public.coupons enable row level security;

create policy "Catalog is readable by everyone" on public.restaurants for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.menu_categories for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.menu_items for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.offers for select to anon, authenticated using (true);
create policy "Catalog is readable by everyone" on public.coupons for select to anon, authenticated using (true);

-- Defense in depth on top of RLS (no write policies exist either).
revoke insert, update, delete on public.restaurants, public.menu_categories, public.menu_items, public.offers, public.coupons
  from anon, authenticated;
```

- [ ] **Step 4: Create `supabase/migrations/20261012000200_users.sql`**

```sql
-- Per-user data: profiles, addresses, favorites. Every row is visible only to its owner.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Only `name` is editable from the app.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (label in ('Home', 'Work', 'Other')),
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  area text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  landmark text,
  instructions text,
  is_default boolean not null default false,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses(user_id);
create unique index addresses_one_default_per_user on public.addresses(user_id) where is_default;

alter table public.addresses enable row level security;
create policy "Users manage own addresses" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Two statements (clear, then set) because the partial unique index is checked row by row.
create function public.set_default_address(address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.addresses set is_default = false
   where user_id = auth.uid() and is_default and id <> address_id;
  update public.addresses set is_default = true
   where user_id = auth.uid() and id = address_id;
end;
$$;

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('restaurant', 'menu_item')),
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target_id)
);

alter table public.favorites enable row level security;
create policy "Users read own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own favorites" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users remove own favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));
```

- [ ] **Step 5: Create `supabase/migrations/20261012000300_orders.sql`**

```sql
-- Orders are written only by the Edge Functions (service role) and the tracking job.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text not null,
  restaurant_id text not null references public.restaurants(id),
  restaurant_name text not null,
  items jsonb not null,
  address jsonb not null,
  delivery_instructions text,
  payment_method text not null check (payment_method in ('upi', 'card', 'netbanking', 'cod')),
  payment_status text not null check (payment_status in ('paid_simulated', 'pending_cod', 'refunded_simulated')),
  status text not null default 'placed' check (status in (
    'placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'failed'
  )),
  subtotal integer not null,
  discount integer not null default 0,
  delivery_fee integer not null default 0,
  tax integer not null default 0,
  total integer not null,
  coupon_code text,
  eta_minutes integer not null,
  placed_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index orders_user_id_placed_at_idx on public.orders(user_id, placed_at desc);
create index orders_active_idx on public.orders(status) where status not in ('delivered', 'cancelled', 'failed');

alter table public.orders enable row level security;
create policy "Users read own orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.orders from anon, authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Clients may only set read_at.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.orders, public.notifications;
```

- [ ] **Step 6: Create `supabase/migrations/20261012000400_tracking.sql`**

```sql
-- Server-side tracking simulation: a pg_cron job advances active orders by elapsed time,
-- and a trigger turns every status change into an in-app notification.

create extension if not exists pg_cron with schema pg_catalog;

create function public.order_status_rank(s text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(
    array['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered'],
    s
  )
$$;

create function public.target_order_status(elapsed interval)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when elapsed >= interval '8 minutes' then 'delivered'
    when elapsed >= interval '6 minutes' then 'out_for_delivery'
    when elapsed >= interval '5 minutes' then 'picked_up'
    when elapsed >= interval '4 minutes' then 'ready'
    when elapsed >= interval '90 seconds' then 'preparing'
    when elapsed >= interval '30 seconds' then 'confirmed'
    else 'placed'
  end
$$;

create function public.advance_order_statuses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  advanced integer;
begin
  update public.orders o
     set status = public.target_order_status(now() - o.placed_at),
         status_updated_at = now()
   where o.status not in ('delivered', 'cancelled', 'failed')
     and public.order_status_rank(public.target_order_status(now() - o.placed_at)) > public.order_status_rank(o.status);
  get diagnostics advanced = row_count;
  return advanced;
end;
$$;

-- Security-definer functions in public are callable through the API by default; this one is
-- for the cron job only.
revoke execute on function public.advance_order_statuses() from public, anon, authenticated;

create function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_title text;
  n_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select x.title, x.body into n_title, n_body
  from (values
    ('confirmed', 'Order confirmed', format('%s has accepted your order.', new.restaurant_name)),
    ('preparing', 'Being prepared', format('%s is preparing your food.', new.restaurant_name)),
    ('ready', 'Ready for pickup', format('Your order from %s is packed and waiting for a rider.', new.restaurant_name)),
    ('picked_up', 'Picked up', format('A rider has picked up your order from %s.', new.restaurant_name)),
    ('out_for_delivery', 'Out for delivery', format('Your order from %s is on its way!', new.restaurant_name)),
    ('delivered', 'Delivered', format('Your order from %s has been delivered. Enjoy!', new.restaurant_name)),
    ('cancelled', 'Order cancelled', format('Your order from %s was cancelled.', new.restaurant_name)),
    ('failed', 'Order failed', format('Something went wrong with your order from %s.', new.restaurant_name))
  ) as x(status, title, body)
  where x.status = new.status;

  if n_title is not null then
    insert into public.notifications (user_id, order_id, title, body)
    values (new.user_id, new.id, n_title, n_body);
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_order_status_change() from public, anon, authenticated;

create trigger orders_status_notify
  after update of status on public.orders
  for each row execute function public.notify_order_status_change();

select cron.schedule('advance-orders', '30 seconds', 'select public.advance_order_statuses()');
```

- [ ] **Step 7: Create `supabase/migrations/20261012000500_search.sql`**

```sql
-- Catalog search used by the app's Search screen. Dishes from closed restaurants are excluded
-- (matching Sub-project 1's behaviour); restaurants themselves are always searchable.

create function public.search_catalog(q text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with term as (
    select '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select jsonb_build_object(
    'restaurants', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rating desc, r.name)
      from public.restaurants r, term
      where r.name ilike term.pattern
         or array_to_string(r.cuisines, ' ') ilike term.pattern
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.rating desc nulls last, m.name)
      from public.menu_items m
      join public.restaurants r on r.id = m.restaurant_id, term
      where r.is_open
        and (m.name ilike term.pattern or m.description ilike term.pattern)
    ), '[]'::jsonb)
  )
$$;
```

- [ ] **Step 8: Sanity-check the app is still green** (no app code changed, but `package.json` did)

Run: `npx tsc --noEmit` → exit 0. Run: `npx jest` → all pass.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json supabase/config.toml supabase/migrations
git commit -m "feat: add Supabase config and schema migrations (catalog, users, orders, tracking, search)"
```

---

### Task 5: Seed SQL generator

**Files:**
- Modify: `data/seed/offers.ts` (coupon expiry dates)
- Create: `scripts/generate-seed-sql.ts`
- Create (generated): `supabase/seed.sql`
- Test: `tests/seed-sql.test.ts`

**Interfaces:**
- Consumes: `restaurantToRow`, `menuCategoryToRow`, `menuItemToRow`, `offerToRow`, `couponToRow` (Task 2).
- Produces: `buildSeedSql(): string`, `sqlValue(column: string, value: unknown): string`, `quote(s: string): string`, `SEED_SQL_PATH: string`.

- [ ] **Step 1: Extend valid coupon expiries** — in `data/seed/offers.ts`, change `expiresAt` to `"2027-12-31"` for `BIRYANI20`, `FIRSTFREE`, `FLAT50`, `PIZZA15`, `HEALTHY30`. Leave `EXPIRED10` at `"2025-01-01"`.

- [ ] **Step 2: Write the failing test** — `tests/seed-sql.test.ts`

```ts
import { readFileSync } from "fs";
import { buildSeedSql, quote, sqlValue, SEED_SQL_PATH } from "../scripts/generate-seed-sql";

describe("seed SQL generator", () => {
  it("escapes single quotes", () => {
    expect(quote("Domino's")).toBe("'Domino''s'");
  });

  it("types empty arrays by column", () => {
    expect(sqlValue("cuisines", [])).toBe("'{}'::text[]");
    expect(sqlValue("option_groups", [])).toBe("'[]'::jsonb");
  });

  it("renders text arrays, json, scalars and nulls", () => {
    expect(sqlValue("tags", ["Top Rated", "Kid's Pick"])).toBe("array['Top Rated', 'Kid''s Pick']::text[]");
    expect(sqlValue("add_ons", [{ id: "a1" }])).toBe(`'[{"id":"a1"}]'::jsonb`);
    expect(sqlValue("base_price", 220)).toBe("220");
    expect(sqlValue("is_open", false)).toBe("false");
    expect(sqlValue("phone", null)).toBe("null");
  });

  it("upserts every catalog table", () => {
    const sql = buildSeedSql();
    for (const table of ["restaurants", "menu_categories", "menu_items", "offers", "coupons"]) {
      expect(sql).toContain(`insert into public.${table} (`);
    }
    expect(sql).toContain("on conflict (code) do update set");
  });

  it("supabase/seed.sql is up to date with data/seed (run: npx tsx scripts/generate-seed-sql.ts)", () => {
    const onDisk = readFileSync(SEED_SQL_PATH, "utf8").replace(/\r\n/g, "\n");
    expect(onDisk).toBe(buildSeedSql());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/seed-sql.test.ts`
Expected: FAIL — `Cannot find module '../scripts/generate-seed-sql'`.

- [ ] **Step 4: Implement `scripts/generate-seed-sql.ts`**

```ts
// Generates supabase/seed.sql from the TypeScript seed files, which stay the single source
// of truth for the catalog. Run after editing data/seed/*.ts:
//   npx tsx scripts/generate-seed-sql.ts
import { writeFileSync } from "fs";
import { join } from "path";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_CATEGORIES } from "../data/seed/categories";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_OFFERS, SEED_COUPONS } from "../data/seed/offers";
import {
  couponToRow, menuCategoryToRow, menuItemToRow, offerToRow, restaurantToRow,
} from "../supabase/functions/_shared/mappers";

export const SEED_SQL_PATH = join(__dirname, "..", "supabase", "seed.sql");

const TEXT_ARRAY_COLUMNS = new Set(["cuisines", "offer_ids", "tags"]);
const JSONB_COLUMNS = new Set(["option_groups", "add_ons"]);

export function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export function sqlValue(column: string, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (TEXT_ARRAY_COLUMNS.has(column)) {
    const items = value as string[];
    return items.length ? `array[${items.map(quote).join(", ")}]::text[]` : "'{}'::text[]";
  }
  if (JSONB_COLUMNS.has(column)) return `${quote(JSON.stringify(value))}::jsonb`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return quote(value);
  throw new Error(`Unsupported value for column "${column}": ${JSON.stringify(value)}`);
}

function upsert<T extends object>(table: string, key: keyof T & string, rows: T[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => `  (${columns.map((c) => sqlValue(c, (row as Record<string, unknown>)[c])).join(", ")})`)
    .join(",\n");
  const updates = columns
    .filter((c) => c !== key)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return `insert into public.${table} (${columns.join(", ")}) values\n${values}\non conflict (${key}) do update set ${updates};\n`;
}

export function buildSeedSql(): string {
  return [
    "-- GENERATED FILE - do not edit by hand.",
    "-- Source: data/seed/*.ts. Regenerate with: npx tsx scripts/generate-seed-sql.ts",
    "",
    upsert("restaurants", "id", SEED_RESTAURANTS.map(restaurantToRow)),
    upsert("menu_categories", "id", SEED_CATEGORIES.map(menuCategoryToRow)),
    upsert("menu_items", "id", SEED_MENU_ITEMS.map(menuItemToRow)),
    upsert("offers", "id", SEED_OFFERS.map(offerToRow)),
    upsert("coupons", "code", SEED_COUPONS.map(couponToRow)),
  ].join("\n");
}

if (require.main === module) {
  writeFileSync(SEED_SQL_PATH, buildSeedSql());
  console.log(`Wrote ${SEED_SQL_PATH}`);
}
```

- [ ] **Step 5: Generate the seed file**

Run: `npx tsx scripts/generate-seed-sql.ts`
Expected: prints `Wrote …\supabase\seed.sql`; the file starts with the GENERATED header and contains 5 `insert into public.` statements.

- [ ] **Step 6: Run tests**

Run: `npx jest`
Expected: all pass (the 5 seed-sql tests included). Run `npx tsc --noEmit` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add data/seed/offers.ts scripts/generate-seed-sql.ts supabase/seed.sql tests/seed-sql.test.ts
git commit -m "feat: generate supabase/seed.sql from the TypeScript seed data"
```

---

### Task 6: Edge Functions (`place-order`, `cancel-order`)

**Files:**
- Create: `supabase/functions/_server/http.ts`
- Create: `supabase/functions/_server/clients.ts`
- Create: `supabase/functions/place-order/index.ts`
- Create: `supabase/functions/cancel-order/index.ts`

**Interfaces:**
- Consumes: `validateAndPriceOrder`, `isCancellable`, `CANCELLABLE_STATUSES` (Task 3); `ORDER_ERROR_STATUS`, `OrderErrorBody` (Task 3); `restaurantFromRow`, `menuItemFromRow`, `couponFromRow`, `addressFromRow` (Task 2); tables from Task 4.
- Produces (HTTP contract used by Task 10's `services/orders.ts` and Task 13's smoke test):
  - `POST /functions/v1/place-order` body = `PlaceOrderInput` → `200 { order: <orders row, snake_case> }` or `<status> { error: OrderErrorBody }`.
  - `POST /functions/v1/cancel-order` body = `{ orderId: string }` → `200 { order: <orders row> }` or error.

These run on Deno in Supabase's cloud. There is no local Deno/Docker in this project, so correctness of the logic is covered by Task 3's tests, and the deployed behaviour by Task 13's smoke test. Step 5 type-checks with Deno via npm if available.

- [ ] **Step 1: Create `supabase/functions/_server/http.ts`**

```ts
import { ORDER_ERROR_STATUS, type OrderErrorBody } from "../_shared/order-errors.ts";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(error: OrderErrorBody): Response {
  return json({ error }, ORDER_ERROR_STATUS[error.code]);
}
```

- [ ] **Step 2: Create `supabase/functions/_server/clients.ts`**

```ts
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Hosted functions expose the legacy SUPABASE_SERVICE_ROLE_KEY and/or the newer
// SUPABASE_SECRET_KEYS JSON dictionary (e.g. {"default":"sb_secret_..."}); accept either.
function firstKeyFromJson(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0];
  } catch {
    return undefined;
  }
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? firstKeyFromJson(Deno.env.get("SUPABASE_SECRET_KEYS"));
  if (!url || !key) throw new Error("SUPABASE_URL or the service key is not available to this function");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Returns the signed-in caller's user id, or null for anonymous/invalid tokens. */
export async function getCallerId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
```

- [ ] **Step 3: Create `supabase/functions/place-order/index.ts`**

```ts
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
```

- [ ] **Step 4: Create `supabase/functions/cancel-order/index.ts`**

```ts
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
```

- [ ] **Step 5: Type-check the functions with Deno (best effort)**

Run: `npx --yes deno@2 check supabase/functions/place-order/index.ts supabase/functions/cancel-order/index.ts`
Expected: `Check …` lines and exit 0. If the `deno` npm package cannot be downloaded in this environment, note it in the task report and continue — Task 13's smoke test exercises the deployed functions.

- [ ] **Step 6: Confirm the app is unaffected**

Run: `npx tsc --noEmit` → exit 0 (the function `index.ts` files and `_server/` are excluded). Run: `npx jest` → all pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_server supabase/functions/place-order supabase/functions/cancel-order
git commit -m "feat: add place-order and cancel-order Edge Functions"
```

---

### Task 7: App Supabase client with chunked SecureStore session storage

**Files:**
- Modify: `package.json` / `package-lock.json`
- Create: `lib/secure-chunked-storage.ts`
- Create: `lib/supabase.ts`
- Create: `.env.example`
- Test: `tests/secure-chunked-storage.test.ts`

**Interfaces:**
- Produces: `secureChunkedStorage: { getItem(key): Promise<string|null>; setItem(key, value): Promise<void>; removeItem(key): Promise<void> }`; `supabase` (a `SupabaseClient`) exported from `lib/supabase.ts`.

- [ ] **Step 1: Install dependencies**

Run: `npx expo install @supabase/supabase-js react-native-url-polyfill`
Expected: both added to `dependencies`.

- [ ] **Step 2: Write the failing test** — `tests/secure-chunked-storage.test.ts`

```ts
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import * as SecureStore from "expo-secure-store";
import { secureChunkedStorage } from "../lib/secure-chunked-storage";

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

describe("secureChunkedStorage", () => {
  it("round-trips a large multi-byte value with every chunk under SecureStore's 2048-byte limit", async () => {
    const value = "é".repeat(2500) + "x".repeat(2500);
    await secureChunkedStorage.setItem("sb-test-auth-token", value);
    expect(await secureChunkedStorage.getItem("sb-test-auth-token")).toBe(value);
    for (const [key, chunk] of store) {
      if (!key.endsWith(".count")) expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(2048);
    }
  });

  it("returns null for a missing key", async () => {
    expect(await secureChunkedStorage.getItem("nothing-here")).toBeNull();
  });

  it("removeItem deletes every chunk and the count", async () => {
    await secureChunkedStorage.setItem("k", "y".repeat(3000));
    await secureChunkedStorage.removeItem("k");
    expect(store.size).toBe(0);
  });

  it("overwriting with a shorter value leaves no stale chunks", async () => {
    await secureChunkedStorage.setItem("k", "y".repeat(3000));
    await secureChunkedStorage.setItem("k", "short");
    expect(store.size).toBe(2); // k.0 + k.count
    expect(await secureChunkedStorage.getItem("k")).toBe("short");
  });

  it("sanitizes characters SecureStore does not allow in keys", async () => {
    await secureChunkedStorage.setItem("a:b/c", "v");
    expect(store.has("a_b_c.0")).toBe(true);
    expect(await secureChunkedStorage.getItem("a:b/c")).toBe("v");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/secure-chunked-storage.test.ts`
Expected: FAIL — `Cannot find module '../lib/secure-chunked-storage'`.

- [ ] **Step 4: Implement `lib/secure-chunked-storage.ts`**

```ts
import * as SecureStore from "expo-secure-store";

// SecureStore warns (and some Android devices fail) on values over ~2048 bytes, and a
// Supabase session (access token + refresh token + user JSON) routinely exceeds that. This
// adapter splits each value into numbered chunks and reassembles them on read. 600 chars per
// chunk stays under 2048 bytes even if every character were a 3-byte UTF-8 sequence.
const CHUNK_CHARS = 600;

// SecureStore keys may only contain alphanumerics, ".", "-" and "_".
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

const countKey = (base: string) => `${base}.count`;
const chunkKey = (base: string, index: number) => `${base}.${index}`;

async function removeItem(key: string): Promise<void> {
  const base = safeKey(key);
  const countRaw = await SecureStore.getItemAsync(countKey(base));
  const count = countRaw === null ? 0 : Number(countRaw);
  await SecureStore.deleteItemAsync(countKey(base));
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(base, i));
  }
}

async function getItem(key: string): Promise<string | null> {
  const base = safeKey(key);
  const countRaw = await SecureStore.getItemAsync(countKey(base));
  if (countRaw === null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(countRaw); i++) {
    const part = await SecureStore.getItemAsync(chunkKey(base, i));
    if (part === null) return null; // interrupted write: treat as no session
    parts.push(part);
  }
  return parts.join("");
}

async function setItem(key: string, value: string): Promise<void> {
  const base = safeKey(key);
  await removeItem(key);
  const count = Math.max(1, Math.ceil(value.length / CHUNK_CHARS));
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(chunkKey(base, i), value.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS));
  }
  // Written last, so a crash mid-write leaves no count and getItem returns null.
  await SecureStore.setItemAsync(countKey(base), String(count));
}

export const secureChunkedStorage = { getItem, setItem, removeItem };
```

- [ ] **Step 5: Run the test**

Run: `npx jest tests/secure-chunked-storage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Implement `lib/supabase.ts`**

```ts
import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { secureChunkedStorage } from "./secure-chunked-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env, " +
      "fill in your Supabase project values (see docs/backend-setup.md), then restart Expo with --clear."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureChunkedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's documented React Native pattern: refresh tokens only while the app is foregrounded.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 7: Create `.env.example`**

```
# Copy this file to .env and fill in the values from the Supabase dashboard:
# Project Settings -> API. The key may be the legacy "anon" key or a newer
# "sb_publishable_..." key; both are safe to ship in the app (RLS protects the data).
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

- [ ] **Step 8: Run all checks**

Run: `npx tsc --noEmit` → exit 0. Run: `npx jest` → all pass.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/secure-chunked-storage.ts lib/supabase.ts .env.example tests/secure-chunked-storage.test.ts
git commit -m "feat: add Supabase client with chunked SecureStore session storage"
```

---

### Task 8: Catalog services on Supabase; screens stop importing seed data

**Files:**
- Modify: `services/restaurants.ts` (rewrite)
- Create: `services/offers.ts`
- Modify: `services/search.ts` (rewrite)
- Modify: `services/coupons.ts` (rewrite)
- Delete: `tests/coupons.test.ts`
- Modify: `app/(tabs)/home.tsx`, `app/(tabs)/explore.tsx`, `app/(tabs)/favorites.tsx`, `app/restaurant/[id].tsx`, `components/home/RestaurantCard.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 7); mappers (Task 2); `checkCoupon` (Task 1); SQL `search_catalog` (Task 4).
- Produces: `getRestaurants(): Promise<Restaurant[]>`, `getRestaurantById(id): Promise<Restaurant|null>`, `getMenuForRestaurant(id): Promise<{categories; items}>`, `getMenuItemById(id): Promise<MenuItem|null>`, `getAllMenuItems(): Promise<MenuItem[]>`, `getOffers(): Promise<Offer[]>`, `searchAll(q)`, `validateCoupon(code, subtotal, restaurantId)`. TanStack Query keys: `["restaurants"]`, `["restaurant", id]`, `["menu", restaurantId]`, `["menu-items"]`, `["offers"]`.

- [ ] **Step 1: Rewrite `services/restaurants.ts`**

```ts
import { supabase } from "../lib/supabase";
import { MenuCategory, MenuItem, Restaurant } from "../types/domain";
import { menuCategoryFromRow, menuItemFromRow, restaurantFromRow } from "../supabase/functions/_shared/mappers";

export async function getRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.from("restaurants").select("*").order("rating_count", { ascending: false });
  if (error) throw error;
  return data.map(restaurantFromRow);
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? restaurantFromRow(data) : null;
}

export async function getMenuForRestaurant(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  const [categoriesRes, itemsRes] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("name"),
  ]);
  if (categoriesRes.error) throw categoriesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  return { categories: categoriesRes.data.map(menuCategoryFromRow), items: itemsRes.data.map(menuItemFromRow) };
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  const { data, error } = await supabase.from("menu_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? menuItemFromRow(data) : null;
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("rating", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data.map(menuItemFromRow);
}
```

- [ ] **Step 2: Create `services/offers.ts`**

```ts
import { supabase } from "../lib/supabase";
import { Offer } from "../types/domain";
import { offerFromRow } from "../supabase/functions/_shared/mappers";

export async function getOffers(): Promise<Offer[]> {
  const { data, error } = await supabase.from("offers").select("*").order("id");
  if (error) throw error;
  return data.map(offerFromRow);
}
```

- [ ] **Step 3: Rewrite `services/search.ts`**

```ts
import { supabase } from "../lib/supabase";
import { MenuItem, Restaurant } from "../types/domain";
import { menuItemFromRow, MenuItemRow, restaurantFromRow, RestaurantRow } from "../supabase/functions/_shared/mappers";

// search_catalog (SQL) excludes dishes from closed restaurants, matching the defense-in-depth
// rule from Sub-project 1: place-order's isOpen check is authoritative, but closed
// restaurants' dishes shouldn't surface as addable results in the first place.
export async function searchAll(query: string): Promise<{ restaurants: Restaurant[]; items: MenuItem[] }> {
  const q = query.trim();
  if (!q) return { restaurants: [], items: [] };
  const { data, error } = await supabase.rpc("search_catalog", { q });
  if (error) throw error;
  const result = data as { restaurants: RestaurantRow[]; items: MenuItemRow[] };
  return { restaurants: result.restaurants.map(restaurantFromRow), items: result.items.map(menuItemFromRow) };
}
```

- [ ] **Step 4: Rewrite `services/coupons.ts`**

```ts
import { supabase } from "../lib/supabase";
import { checkCoupon } from "../supabase/functions/_shared/coupons";
import { couponFromRow } from "../supabase/functions/_shared/mappers";
import { Coupon } from "../types/domain";

export type CouponValidationResult = { ok: true; coupon: Coupon } | { ok: false; reason: string };

// Cart/checkout preview only. place-order re-runs the same checkCoupon rules before charging.
export async function validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<CouponValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "Enter a coupon code" };
  const { data, error } = await supabase.from("coupons").select("*").eq("code", normalized).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, reason: "Invalid coupon code" };
  const coupon = couponFromRow(data);
  const check = checkCoupon(coupon, subtotal, restaurantId, new Date());
  return check.ok ? { ok: true, coupon } : check;
}
```

Then delete the old service test (its behaviour is covered by `tests/check-coupon.test.ts`, and the service now needs a live database):

```bash
git rm tests/coupons.test.ts
```

- [ ] **Step 5: `app/(tabs)/home.tsx` — read dishes and offers from the services**

Replace the two seed imports:

```ts
import { SEED_MENU_ITEMS } from "../../data/seed/menu-items";
import { SEED_OFFERS } from "../../data/seed/offers";
```

with:

```ts
import { getAllMenuItems } from "../../services/restaurants";
import { getOffers } from "../../services/offers";
```

(Keep the existing `import { getRestaurants } from "../../services/restaurants";` line — or merge both names into it.)

Replace:

```ts
  const trendingDishes = useMemo(() => SEED_MENU_ITEMS.filter((i) => i.popular), []);
```

with:

```ts
  const { data: allMenuItems } = useQuery({ queryKey: ["menu-items"], queryFn: getAllMenuItems });
  const { data: offers } = useQuery({ queryKey: ["offers"], queryFn: getOffers });
  const trendingDishes = useMemo(() => (allMenuItems ?? []).filter((i) => i.popular), [allMenuItems]);
```

Replace `data={SEED_OFFERS}` with `data={offers ?? []}`.

- [ ] **Step 6: `app/(tabs)/explore.tsx` — derive veg-only and popular dishes from fetched items**

Replace `import { SEED_MENU_ITEMS } from "../../data/seed/menu-items";` with:

```ts
import { getAllMenuItems } from "../../services/restaurants";
import { MenuItem } from "../../types/domain";
```

and change `import { getRestaurants } from "../../services/restaurants";` accordingly (one import line with both names is fine).

Replace the `isPureVegRestaurant` function with:

```ts
function isPureVegRestaurant(restaurantId: string, menuItems: MenuItem[]): boolean {
  return !menuItems.some(
    (item) => item.restaurantId === restaurantId && (item.vegFlag === "non-veg" || item.vegFlag === "egg")
  );
}
```

Inside `Explore()`, directly after the `useQuery` for restaurants, add:

```ts
  const { data: allMenuItems } = useQuery({ queryKey: ["menu-items"], queryFn: getAllMenuItems });
  const menuItems = allMenuItems ?? [];
```

Replace the `popularDishes` memo with:

```ts
  const popularDishes = useMemo(
    () =>
      [...menuItems]
        .filter((i) => i.isAvailable)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 10),
    [menuItems]
  );
```

In `filteredRestaurants`, change `isPureVegRestaurant(r.id)` to `isPureVegRestaurant(r.id, menuItems)` and add `menuItems` to that memo's dependency array: `[restaurants, sortBy, vegOnly, menuItems]`.

- [ ] **Step 7: `app/(tabs)/favorites.tsx` — resolve favorites against fetched data**

Replace:

```ts
import { SEED_RESTAURANTS } from "../../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../../data/seed/menu-items";
```

with:

```ts
import { useQuery } from "@tanstack/react-query";
import { getRestaurants, getAllMenuItems } from "../../services/restaurants";
```

Replace the two memos:

```ts
  const favoriteRestaurants = useMemo(
    () => SEED_RESTAURANTS.filter((r) => restaurantIds.includes(r.id)),
    [restaurantIds]
  );
  const favoriteDishes = useMemo(
    () => SEED_MENU_ITEMS.filter((i) => menuItemIds.includes(i.id)),
    [menuItemIds]
  );
```

with:

```ts
  const { data: restaurants } = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants });
  const { data: allMenuItems } = useQuery({ queryKey: ["menu-items"], queryFn: getAllMenuItems });

  const favoriteRestaurants = useMemo(
    () => (restaurants ?? []).filter((r) => restaurantIds.includes(r.id)),
    [restaurants, restaurantIds]
  );
  const favoriteDishes = useMemo(
    () => (allMenuItems ?? []).filter((i) => menuItemIds.includes(i.id)),
    [allMenuItems, menuItemIds]
  );
```

- [ ] **Step 8: `app/restaurant/[id].tsx` — offers from the service**

Replace `import { SEED_OFFERS } from "../../data/seed/offers";` with `import { getOffers } from "../../services/offers";`.

Replace:

```ts
  const offers = restaurantId ? SEED_OFFERS.filter((o) => o.restaurantId === restaurantId) : [];
```

with:

```ts
  const offersQuery = useQuery({ queryKey: ["offers"], queryFn: getOffers });
  const offers = (offersQuery.data ?? []).filter((o) => o.restaurantId === restaurantId);
```

This line must stay above any early `return` in the component (it already is — it sits before `isLoading`).

- [ ] **Step 9: `components/home/RestaurantCard.tsx` — offers from the cached query**

Replace `import { SEED_OFFERS } from "../../data/seed/offers";` with:

```ts
import { useQuery } from "@tanstack/react-query";
import { getOffers } from "../../services/offers";
```

Replace `const offer = SEED_OFFERS.find((o) => o.restaurantId === restaurant.id);` with:

```ts
  // Every card shares the ["offers"] query, so this is one network request app-wide.
  const { data: offers } = useQuery({ queryKey: ["offers"], queryFn: getOffers });
  const offer = offers?.find((o) => o.restaurantId === restaurant.id);
```

- [ ] **Step 10: Verify no screen imports seed data any more**

Run: `git grep -n "data/seed" -- app components`
Expected: no output.

- [ ] **Step 11: Run all checks**

Run: `npx tsc --noEmit` → exit 0. Run: `npx jest` → all pass.

- [ ] **Step 12: Commit**

```bash
git add -A services app components tests
git commit -m "feat: read the catalog, offers, search and coupons from Supabase"
```

---

### Task 9: Email-OTP auth, profiles, and guest gating

**Files:**
- Modify: `services/auth.ts` (rewrite)
- Create: `features/auth/requireSignIn.ts`
- Modify: `app/_layout.tsx`
- Modify: `app/auth/login.tsx` (rewrite)
- Modify: `app/auth/otp.tsx` (rewrite)
- Modify: `app/auth/location-select.tsx`
- Modify: `app/cart/index.tsx`
- Modify: `components/home/RestaurantCard.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/profile/edit.tsx`
- Modify: `app/(tabs)/orders.tsx`, `app/(tabs)/favorites.tsx` (guest states)
- Test: `tests/require-sign-in.test.ts`

**Interfaces:**
- Consumes: `supabase` (Task 7); `useAuthStore` (`user`, `setUser`, `setHydrated`).
- Produces:
  - `services/auth.ts`: `getCurrentUser(): Promise<User|null>`, `userFromSession(session: Session): Promise<User>`, `signInAsGuest(): Promise<User>`, `requestOtp(email: string): Promise<void>`, `verifyOtp(email: string, code: string): Promise<User>`, `signOut(): Promise<void>`, `updateProfileName(userId: string, name: string): Promise<void>`.
  - `requireSignIn(returnTo: string): boolean` (`features/auth/requireSignIn.ts`).
  - Signed-in `User` = `{ id, name, email, isGuest: false }` (`name` is `""` until the user sets it). Guest `User` = `{ id: "guest", name: "Guest", isGuest: true }`.
  - Login route accepts `?returnTo=<path>`; OTP route accepts `?email=…&returnTo=…`; location-select accepts `?returnTo=…`.

- [ ] **Step 1: Write the failing test** — `tests/require-sign-in.test.ts`

```ts
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { router } from "expo-router";
import { requireSignIn } from "../features/auth/requireSignIn";
import { useAuthStore } from "../store/auth-store";

const push = router.push as jest.Mock;

beforeEach(() => push.mockClear());

describe("requireSignIn", () => {
  it("lets signed-in users through without navigating", () => {
    useAuthStore.setState({ user: { id: "u1", name: "Asha", email: "a@example.com", isGuest: false } });
    expect(requireSignIn("/checkout")).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("sends guests to login with an encoded returnTo", () => {
    useAuthStore.setState({ user: { id: "guest", name: "Guest", isGuest: true } });
    expect(requireSignIn("/checkout")).toBe(false);
    expect(push).toHaveBeenCalledWith("/auth/login?returnTo=%2Fcheckout");
  });

  it("treats a missing user like a guest", () => {
    useAuthStore.setState({ user: null });
    expect(requireSignIn("/addresses")).toBe(false);
    expect(push).toHaveBeenCalledWith("/auth/login?returnTo=%2Faddresses");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/require-sign-in.test.ts`
Expected: FAIL — `Cannot find module '../features/auth/requireSignIn'`.

- [ ] **Step 3: Implement `features/auth/requireSignIn.ts`**

```ts
import { router } from "expo-router";
import { useAuthStore } from "../../store/auth-store";

// Gate for account-only actions (checkout, favorites, addresses). Guests are sent to login
// and brought back to `returnTo` after signing in; the device-local cart survives untouched.
export function requireSignIn(returnTo: string): boolean {
  const user = useAuthStore.getState().user;
  if (user && !user.isGuest) return true;
  router.push(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  return false;
}
```

- [ ] **Step 4: Run the test**

Run: `npx jest tests/require-sign-in.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewrite `services/auth.ts`**

```ts
import * as SecureStore from "expo-secure-store";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { User } from "../types/domain";

// Guest mode is device-local only (no Supabase session): a flag in SecureStore.
const GUEST_KEY = "aaharam_guest";
const GUEST_USER: User = { id: "guest", name: "Guest", isGuest: true };

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("security purposes")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (lower.includes("not authorized")) {
    return "This email can't receive sign-in codes yet. The app owner needs to finish email setup (docs/backend-setup.md).";
  }
  return message;
}

export async function userFromSession(session: Session): Promise<User> {
  const { data } = await supabase.from("profiles").select("name, email").eq("id", session.user.id).maybeSingle();
  return {
    id: session.user.id,
    name: data?.name ?? "",
    email: data?.email ?? session.user.email ?? undefined,
    isGuest: false,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return userFromSession(data.session);
  return (await SecureStore.getItemAsync(GUEST_KEY)) === "true" ? GUEST_USER : null;
}

export async function signInAsGuest(): Promise<User> {
  await SecureStore.setItemAsync(GUEST_KEY, "true");
  return GUEST_USER;
}

export async function requestOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function verifyOtp(email: string, code: string): Promise<User> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.session) {
    throw new Error(error ? friendlyAuthError(error.message) : "That code is invalid or has expired. Request a new one.");
  }
  await SecureStore.deleteItemAsync(GUEST_KEY);
  return userFromSession(data.session);
}

export async function updateProfileName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await SecureStore.deleteItemAsync(GUEST_KEY);
}
```

- [ ] **Step 6: Wire auth state in `app/_layout.tsx`**

Add imports:

```ts
import { supabase } from "../lib/supabase";
import { userFromSession } from "../services/auth";
```

(keep `getCurrentUser`). Replace the existing hydration `useEffect` with:

```ts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser().catch(() => null);
      if (cancelled) return;
      setUser(user);
      setHydrated();
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (!useAuthStore.getState().user?.isGuest) setUser(null);
        queryClient.clear();
        return;
      }
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
        // supabase-js warns against awaiting Supabase calls inside this callback (it can
        // deadlock the auth lock), so the profile fetch is deferred to the next tick.
        setTimeout(() => {
          userFromSession(session).then(setUser).catch(() => undefined);
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);
```

- [ ] **Step 7: Rewrite `app/auth/login.tsx`**

```tsx
import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth-store";
import { requestOtp, signInAsGuest } from "../../services/auth";
import { BRAND_NAME } from "../../constants/brand";

const emailSchema = z.string().trim().email("Enter a valid email address");

export default function Login() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  async function onSendCode() {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await requestOtp(result.data);
      const returnQuery = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
      router.push(`/auth/otp?email=${encodeURIComponent(result.data)}${returnQuery}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function onContinueAsGuest() {
    // Reached from a gated action ("Proceed to Checkout", a heart, Addresses): just go back.
    if (returnTo) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/home");
      return;
    }
    setGuestError(null);
    setGuestLoading(true);
    try {
      const user = await signInAsGuest();
      setUser(user);
      router.replace("/(tabs)/home");
    } catch (e) {
      setGuestError(e instanceof Error ? e.message : "Could not continue as guest. Try again.");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-bg">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-3xl font-extrabold text-ink mb-1">{BRAND_NAME}</Text>
        <Text className="text-base text-muted mb-8">
          {returnTo ? "Sign in to continue." : "Sign in to order delicious food."}
        </Text>

        <TextField
          label="Email address"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={error ?? undefined}
        />

        <Button title="Send code" onPress={onSendCode} loading={sending} size="lg" />

        <Text className="text-xs text-muted text-center mt-3">We'll email you a one-time sign-in code.</Text>

        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-muted text-xs mx-3">OR</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <Pressable onPress={onContinueAsGuest} disabled={guestLoading} accessibilityRole="button" hitSlop={8}>
          <Text className="text-primary font-semibold text-center text-base">
            {returnTo ? "Not now" : guestLoading ? "Signing in..." : "Continue as Guest"}
          </Text>
        </Pressable>
        {guestError ? <Text className="text-xs text-danger text-center mt-2">{guestError}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
```

Check `components/ui/TextField.tsx` forwards extra `TextInputProps` (`autoCapitalize`, `autoComplete`). `app/profile/edit.tsx` already passes `autoCapitalize` to it, so it does; if `autoComplete` is rejected by its prop type, drop that one prop.

- [ ] **Step 8: Rewrite `app/auth/otp.tsx`**

```tsx
import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth-store";
import { requestOtp, verifyOtp } from "../../services/auth";

const RESEND_SECONDS = 60;

export default function Otp() {
  const { email, returnTo } = useLocalSearchParams<{ email: string; returnTo?: string }>();
  const setUser = useAuthStore((s) => s.setUser);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onVerify() {
    // Supabase's email OTP length is a project setting (6 by default); accept 6-8 digits.
    if (!/^\d{6,8}$/.test(code)) {
      setError("Enter the code from your email");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const user = await verifyOtp(email ?? "", code);
      setUser(user);
      if (returnTo && user.name.trim()) {
        router.replace(returnTo as any);
      } else {
        const returnQuery = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
        router.replace(`/auth/location-select${returnQuery}` as any);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    setResendMessage(null);
    setError(null);
    try {
      await requestOtp(email ?? "");
      setSecondsLeft(RESEND_SECONDS);
      setResendMessage("A new code is on its way.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend the code.");
    }
  }

  return (
    <View className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-2xl font-bold text-ink mb-1">Check your email</Text>
      <Text className="text-base text-muted mb-6">Enter the code we sent to {email}</Text>

      <TextField
        label="Sign-in code"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={8}
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^\d]/g, ""))}
        error={error ?? undefined}
      />

      <Button title="Verify" onPress={onVerify} loading={verifying} size="lg" />

      <Pressable
        onPress={onResend}
        disabled={secondsLeft > 0}
        accessibilityRole="button"
        accessibilityState={{ disabled: secondsLeft > 0 }}
        hitSlop={8}
        className="mt-5"
      >
        <Text className={`text-center text-sm font-semibold ${secondsLeft > 0 ? "text-muted" : "text-primary"}`}>
          {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
        </Text>
      </Pressable>
      {resendMessage ? <Text className="mt-2 text-center text-xs text-muted">{resendMessage}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 9: `app/auth/location-select.tsx` — one-time name step and `returnTo`**

Change the expo-router import to `import { router, useLocalSearchParams } from "expo-router";` and add:

```ts
import { useAuthStore } from "../../store/auth-store";
import { updateProfileName } from "../../services/auth";
```

At the top of `LocationSelect()`, before the existing `useState` calls, add:

```ts
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const needsName = !!user && !user.isGuest && !user.name.trim();
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  function finish() {
    router.replace((returnTo ?? "/(tabs)/home") as any);
  }

  async function onSaveName() {
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2) {
      setNameError("Enter your name");
      return;
    }
    if (!user) return;
    setSavingName(true);
    setNameError(null);
    try {
      await updateProfileName(user.id, trimmed);
      setUser({ ...user, name: trimmed });
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Couldn't save your name. Try again.");
    } finally {
      setSavingName(false);
    }
  }
```

Replace the mount effect:

```ts
  useEffect(() => {
    requestLocation();
  }, []);
```

with:

```ts
  // Location detection starts only once the (one-time) name step is done.
  useEffect(() => {
    if (!needsName) requestLocation();
  }, [needsName]);
```

Replace each of the three `router.replace("/(tabs)/home");` calls (in `requestLocation`, `onSaveManual`, `onSkip`) with `finish();`.

Immediately before `if (status === "requesting") {`, add the name step:

```tsx
  if (needsName) {
    return (
      <View className="flex-1 bg-bg px-6 justify-center">
        <Text className="text-2xl font-bold text-ink mb-1">What should we call you?</Text>
        <Text className="text-base text-muted mb-6">This is shown on your profile and orders.</Text>
        <TextField
          label="Your name"
          placeholder="e.g. Asha Rao"
          value={nameDraft}
          onChangeText={setNameDraft}
          error={nameError ?? undefined}
        />
        <Button title="Continue" onPress={onSaveName} loading={savingName} size="lg" />
      </View>
    );
  }
```

- [ ] **Step 10: Gate checkout in `app/cart/index.tsx`**

Add `import { requireSignIn } from "../../features/auth/requireSignIn";` and replace the button's `onPress={() => router.push("/checkout")}` with:

```tsx
          onPress={() => {
            if (requireSignIn("/checkout")) router.push("/checkout");
          }}
```

- [ ] **Step 11: Gate favorites in `components/home/RestaurantCard.tsx`**

Add `import { requireSignIn } from "../../features/auth/requireSignIn";` and replace `onToggleFavorite` with:

```ts
  function onToggleFavorite() {
    if (!requireSignIn("/(tabs)/favorites")) return;
    toggleRestaurant(restaurant.id);
  }
```

- [ ] **Step 12: Gate Addresses in `app/(tabs)/profile.tsx`**

Add `import { requireSignIn } from "../../features/auth/requireSignIn";`. In `interface RowConfig`, add `requiresAccount?: boolean;`. In the `rows` array, change the addresses entry to:

```ts
    { key: "addresses", icon: MapPin, label: "Saved Addresses", route: "/addresses", requiresAccount: true },
```

Replace the row `onPress={() => router.push(row.route as any)}` with:

```tsx
              onPress={() => {
                if (row.requiresAccount && !requireSignIn(row.route)) return;
                router.push(row.route as any);
              }}
```

Remove the line `{user?.phone ? <Text className="mt-0.5 text-sm text-muted">{user.phone}</Text> : null}` (phone is no longer part of the account), and change the guest card's button to keep the user on Profile after signing in: `onPress={() => router.push("/auth/login?returnTo=%2F(tabs)%2Fprofile")}`.

- [ ] **Step 13: `app/profile/edit.tsx` — save the name to the server; email read-only**

Add `import { updateProfileName } from "../../services/auth";`. Replace the schema block (the comment + `profileDetailsSchema` + type) with:

```ts
// Only the display name is editable; the email is the sign-in identity and is read-only.
const profileDetailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
});
type ProfileDetailsValues = z.infer<typeof profileDetailsSchema>;
```

Replace `defaultValues: { name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "" },` with `defaultValues: { name: user?.name ?? "" },` and the `reset({...})` call inside the effect with `reset({ name: user?.name ?? "" });`.

Add state next to `savedJustNow`: `const [saveError, setSaveError] = useState<string | null>(null);` and `const isGuest = !user || user.isGuest;`.

Replace `onSaveProfileDetails` with:

```ts
  async function onSaveProfileDetails(values: ProfileDetailsValues) {
    if (!user || user.isGuest) return;
    setSaveError(null);
    try {
      await updateProfileName(user.id, values.name);
      setUser({ ...user, name: values.name });
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  }
```

Replace everything inside the first `<View className="px-4">` under `<SectionHeader title="Profile Details" />` (the three `Controller`s, the Save button and the "Saved for this session only" text) with:

```tsx
          {isGuest ? (
            <View className="mb-1 rounded-2xl border border-border bg-card p-4">
              <Text className="text-sm text-muted mb-3">Sign in to save your name to your account.</Text>
              <Button
                title="Sign In"
                onPress={() => router.push("/auth/login?returnTo=%2Fprofile%2Fedit")}
                accessibilityLabel="Sign in"
              />
            </View>
          ) : (
            <>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <TextField
                    label="Name"
                    placeholder="Your full name"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={errors.name?.message}
                  />
                )}
              />
              <Text className="mb-1 text-xs font-semibold text-muted">Email</Text>
              <Text className="mb-4 text-base text-ink">{user?.email ?? "-"}</Text>
              <Button
                title={savedJustNow ? "Saved!" : "Save"}
                onPress={handleSubmit(onSaveProfileDetails)}
                accessibilityLabel="Save profile details"
              />
              {saveError ? <Text className="mt-2 text-xs text-danger">{saveError}</Text> : null}
            </>
          )}
```

- [ ] **Step 14: Guest states on Orders and Favorites tabs**

`app/(tabs)/orders.tsx`: add `import { useAuthStore } from "../../store/auth-store";`. At the top of `OrdersScreen()` add:

```ts
  const user = useAuthStore((s) => s.user);
  const isGuest = !user || user.isGuest;
```

Change the query to `useQuery({ queryKey: ["orders"], queryFn: getOrders, enabled: !isGuest })`. After all hooks (just before `if (ordersQuery.isLoading)`), add:

```tsx
  if (isGuest) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Text className="px-4 pt-3 pb-2 text-xl font-bold text-ink">Your Orders</Text>
        <EmptyState
          icon={ReceiptText}
          title="Sign in to see your orders"
          description="Your order history and live tracking appear here once you're signed in."
          actionLabel="Sign in"
          onAction={() => router.push("/auth/login?returnTo=%2F(tabs)%2Forders")}
        />
      </View>
    );
  }
```

`app/(tabs)/favorites.tsx`: add `import { useAuthStore } from "../../store/auth-store";`. In `Favorites()`, add `const user = useAuthStore((s) => s.user);` and, after all hooks and the `browse` function, before `renderHeader`, add:

```tsx
  if (!user || user.isGuest) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Text className="px-4 pt-3 pb-4 text-xl font-bold text-ink">Favorites</Text>
        <EmptyState
          icon={Heart}
          title="Sign in to save favorites"
          description="Tap the heart on any restaurant to keep it here."
          actionLabel="Sign in"
          onAction={() => router.push("/auth/login?returnTo=%2F(tabs)%2Ffavorites")}
        />
      </View>
    );
  }
```

(`renderHeader` is a plain function, not a hook, so returning before it is fine.)

- [ ] **Step 15: Run all checks**

Run: `npx tsc --noEmit` → exit 0. Run: `npx jest` → all pass.
Run: `git grep -n "devOtp\|Dev OTP\|Dev mode: OTP" -- app services` → no output.

- [ ] **Step 16: Commit**

```bash
git add -A services/auth.ts features/auth app components tests/require-sign-in.test.ts
git commit -m "feat: email OTP sign-in with Supabase Auth, profile names, and guest gating"
```

---

### Task 10: Addresses, favorites, and orders on Supabase

**Files:**
- Modify: `supabase/functions/_shared/domain.ts` (`Order` shape)
- Modify: `supabase/functions/_shared/mappers.ts` (`OrderRow`, `orderFromRow`)
- Create: `services/order-errors.ts`
- Modify: `services/orders.ts`, `services/addresses.ts`, `services/favorites.ts` (rewrites)
- Modify: `store/favorites-store.ts` (rewrite)
- Create: `lib/legacy-cleanup.ts`
- Modify: `app/_layout.tsx`
- Modify: `app/addresses/index.tsx`, `app/addresses/edit.tsx`
- Modify: `app/order-details/[orderId].tsx`, `app/order-confirmation/[orderId].tsx`
- Modify: `app/(tabs)/home.tsx`, `app/checkout/payment.tsx` (minimal compile fix; full rework in Task 12)
- Delete: `data/seed/orders.ts`, `data/seed/addresses.ts`
- Modify: `tests/reorder.test.ts`
- Test: `tests/order-errors.test.ts`, `tests/legacy-cleanup.test.ts`, `tests/mappers.test.ts` (add order case)

**Interfaces:**
- Consumes: `isOrderErrorCode`, `OrderErrorBody`, `OrderErrorCode` (Task 3); Edge Function HTTP contract (Task 6); `supabase` (Task 7).
- Produces:
  - `Order` gains `address: Address`, `deliveryInstructions?: string`, `paymentStatus: PaymentStatus`, `statusUpdatedAt: string`; loses `addressId`.
  - `OrderRow`, `orderFromRow(row: OrderRow): Order` (mappers).
  - `class OrderError extends Error { code: OrderErrorCode | "NETWORK"; details?: Record<string, unknown> }`, `toOrderError(error: unknown): Promise<OrderError>` (services/order-errors.ts).
  - `services/orders.ts`: `getOrders()`, `getOrderById(id)`, `interface CreateOrderInput` (= `PlaceOrderInput`), `createOrder(input): Promise<Order>`, `cancelOrder(orderId): Promise<Order>`. `updateOrderStatus` is removed.
  - `services/addresses.ts`: `getAddresses()`, `saveAddress(addr: Address): Promise<string>` (empty `id` = create), `setDefaultAddress(id)`, `deleteAddress(id)`.
  - `services/favorites.ts`: `getFavoriteRestaurantIds()`, `getFavoriteMenuItemIds()`, `setRestaurantFavorite(id, favorite)`, `setMenuItemFavorite(id, favorite)`.
  - `useFavoritesStore` adds `reset()`; toggles are optimistic.
  - `clearLegacyLocalData(): Promise<void>` (lib/legacy-cleanup.ts).

- [ ] **Step 1: Write the failing tests**

`tests/order-errors.test.ts`:

```ts
import { OrderError, toOrderError } from "../services/order-errors";

function httpError(body: unknown) {
  return { name: "FunctionsHttpError", context: { json: async () => body } };
}

describe("toOrderError", () => {
  it("maps a structured function error to its code, message and details", async () => {
    const err = await toOrderError(
      httpError({ error: { code: "PRICE_CHANGED", message: "Prices changed", details: { totals: { total: 500 } } } })
    );
    expect(err).toBeInstanceOf(OrderError);
    expect(err.code).toBe("PRICE_CHANGED");
    expect(err.message).toBe("Prices changed");
    expect(err.details).toEqual({ totals: { total: 500 } });
  });

  it("falls back to INTERNAL for an unknown code", async () => {
    expect((await toOrderError(httpError({ error: { code: "WHAT", message: "?" } }))).code).toBe("INTERNAL");
  });

  it("falls back to INTERNAL when the body is not JSON", async () => {
    const err = await toOrderError({ context: { json: async () => { throw new Error("bad json"); } } });
    expect(err.code).toBe("INTERNAL");
  });

  it("maps transport failures to NETWORK", async () => {
    expect((await toOrderError(new Error("Failed to fetch"))).code).toBe("NETWORK");
    expect((await toOrderError({ context: new TypeError("Network request failed") })).code).toBe("NETWORK");
  });
});
```

`tests/legacy-cleanup.test.ts`:

```ts
jest.mock("expo-secure-store", () => ({ deleteItemAsync: jest.fn(async () => undefined) }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { clearLegacyLocalData } from "../lib/legacy-cleanup";

beforeEach(async () => {
  await AsyncStorage.clear();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
});

describe("clearLegacyLocalData", () => {
  it("removes Sub-project 1's local orders, addresses and favorites but keeps the cart", async () => {
    await AsyncStorage.multiSet([
      ["aaharam:orders", "[]"],
      ["aaharam:order-request-ids", "{}"],
      ["aaharam:addresses", "[]"],
      ["aaharam:favorites:restaurants", "[]"],
      ["aaharam:favorites:items", "[]"],
      ["aaharam:cart", "{}"],
    ]);
    await clearLegacyLocalData();
    expect(await AsyncStorage.getItem("aaharam:orders")).toBeNull();
    expect(await AsyncStorage.getItem("aaharam:addresses")).toBeNull();
    expect(await AsyncStorage.getItem("aaharam:favorites:items")).toBeNull();
    expect(await AsyncStorage.getItem("aaharam:cart")).toBe("{}");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("aaharam:session");
  });

  it("runs only once", async () => {
    await clearLegacyLocalData();
    await AsyncStorage.setItem("aaharam:orders", "[]");
    await clearLegacyLocalData();
    expect(await AsyncStorage.getItem("aaharam:orders")).toBe("[]");
  });
});
```

Append to `tests/mappers.test.ts` (and add `orderFromRow, OrderRow` to its import from the mappers module):

```ts
describe("orderFromRow", () => {
  it("maps snake_case order rows, including the address snapshot", () => {
    const address = {
      id: "6f1c1d1e-0000-4000-8000-000000000001", label: "Home" as const, recipientName: "Asha Rao", phone: "9876543210",
      line1: "12 MG Road", area: "Indiranagar", city: "Bengaluru", state: "Karnataka", postalCode: "560038", isDefault: true,
    };
    const row: OrderRow = {
      id: "6f1c1d1e-0000-4000-8000-0000000000bb",
      user_id: "6f1c1d1e-0000-4000-8000-0000000000aa",
      client_request_id: "req-1",
      restaurant_id: "r1",
      restaurant_name: "Biryani Junction",
      items: [{ menuItemId: "m1", name: "Paneer Biryani", quantity: 2, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
      address,
      delivery_instructions: null,
      payment_method: "upi",
      payment_status: "paid_simulated",
      status: "placed",
      subtotal: 440,
      discount: 0,
      delivery_fee: 29,
      tax: 22,
      total: 491,
      coupon_code: null,
      eta_minutes: 35,
      placed_at: "2026-10-12T12:00:00+00:00",
      status_updated_at: "2026-10-12T12:00:00+00:00",
    };
    expect(orderFromRow(row)).toEqual({
      id: row.id,
      restaurantId: "r1",
      restaurantName: "Biryani Junction",
      items: row.items,
      status: "placed",
      placedAt: row.placed_at,
      statusUpdatedAt: row.status_updated_at,
      address,
      paymentMethod: "upi",
      paymentStatus: "paid_simulated",
      subtotal: 440,
      discount: 0,
      deliveryFee: 29,
      tax: 22,
      total: 491,
      etaMinutes: 35,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/order-errors.test.ts tests/legacy-cleanup.test.ts tests/mappers.test.ts`
Expected: FAIL — missing modules `../services/order-errors`, `../lib/legacy-cleanup`, and `orderFromRow` is not exported.

- [ ] **Step 3: Change `Order` in `supabase/functions/_shared/domain.ts`** — replace the `Order` interface with:

```ts
export interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  status: OrderStatus;
  placedAt: string;
  statusUpdatedAt: string;
  /** Snapshot of the delivery address at order time (survives later edits/deletes). */
  address: Address;
  deliveryInstructions?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  couponCode?: string;
  etaMinutes?: number;
}
```

- [ ] **Step 4: Add the order mapper to `supabase/functions/_shared/mappers.ts`**

Extend the domain import with `Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus`, then append:

```ts
export interface OrderRow {
  id: string;
  user_id: string;
  client_request_id: string;
  restaurant_id: string;
  restaurant_name: string;
  items: OrderItem[];
  address: Address;
  delivery_instructions: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  eta_minutes: number;
  placed_at: string;
  status_updated_at: string;
}

export function orderFromRow(o: OrderRow): Order {
  return {
    id: o.id,
    restaurantId: o.restaurant_id,
    restaurantName: o.restaurant_name,
    items: o.items,
    status: o.status,
    placedAt: o.placed_at,
    statusUpdatedAt: o.status_updated_at,
    address: o.address,
    deliveryInstructions: o.delivery_instructions ?? undefined,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.delivery_fee,
    tax: o.tax,
    total: o.total,
    couponCode: o.coupon_code ?? undefined,
    etaMinutes: o.eta_minutes,
  };
}
```

- [ ] **Step 5: Implement `services/order-errors.ts`**

```ts
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
```

- [ ] **Step 6: Rewrite `services/orders.ts`**

```ts
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
```

- [ ] **Step 7: Rewrite `services/addresses.ts`**

```ts
import { supabase } from "../lib/supabase";
import { Address } from "../types/domain";
import { addressFromRow, addressToWrite, type AddressRow } from "../supabase/functions/_shared/mappers";

export async function getAddresses(): Promise<Address[]> {
  const { data, error } = await supabase.from("addresses").select("*").order("created_at");
  if (error) throw error;
  return (data as AddressRow[]).map(addressFromRow);
}

export async function setDefaultAddress(id: string): Promise<void> {
  const { error } = await supabase.rpc("set_default_address", { address_id: id });
  if (error) throw error;
}

/** Creates the address when `addr.id` is empty, otherwise updates it. Returns its id. */
export async function saveAddress(addr: Address): Promise<string> {
  const fields = addressToWrite(addr);
  let id = addr.id;
  if (id) {
    const { error } = await supabase.from("addresses").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    // Inserted as non-default first; set_default_address flips the default atomically, so the
    // one-default-per-user unique index is never violated.
    const { data, error } = await supabase.from("addresses").insert({ ...fields, is_default: false }).select("id").single();
    if (error) throw error;
    id = data.id as string;
  }
  if (addr.isDefault) await setDefaultAddress(id);
  return id;
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 8: Rewrite `services/favorites.ts`**

```ts
import { supabase } from "../lib/supabase";

type FavoriteKind = "restaurant" | "menu_item";

async function readIds(kind: FavoriteKind): Promise<string[]> {
  const { data, error } = await supabase.from("favorites").select("target_id").eq("kind", kind);
  if (error) throw error;
  return data.map((row) => row.target_id as string);
}

async function setFavorite(kind: FavoriteKind, targetId: string, favorite: boolean): Promise<void> {
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ kind, target_id: targetId }, { onConflict: "user_id,kind,target_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("kind", kind).eq("target_id", targetId);
  if (error) throw error;
}

export const getFavoriteRestaurantIds = () => readIds("restaurant");
export const getFavoriteMenuItemIds = () => readIds("menu_item");
export const setRestaurantFavorite = (id: string, favorite: boolean) => setFavorite("restaurant", id, favorite);
export const setMenuItemFavorite = (id: string, favorite: boolean) => setFavorite("menu_item", id, favorite);
```

- [ ] **Step 9: Rewrite `store/favorites-store.ts`**

```ts
import { create } from "zustand";
import {
  getFavoriteRestaurantIds, getFavoriteMenuItemIds, setRestaurantFavorite, setMenuItemFavorite,
} from "../services/favorites";
import { useAuthStore } from "./auth-store";

interface FavoritesState {
  restaurantIds: string[];
  menuItemIds: string[];
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  toggleRestaurant: (id: string) => Promise<void>;
  toggleMenuItem: (id: string) => Promise<void>;
}

function signedIn(): boolean {
  const user = useAuthStore.getState().user;
  return !!user && !user.isGuest;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  restaurantIds: [],
  menuItemIds: [],
  loaded: false,

  load: async () => {
    if (!signedIn()) {
      set({ restaurantIds: [], menuItemIds: [], loaded: true });
      return;
    }
    try {
      const [restaurantIds, menuItemIds] = await Promise.all([getFavoriteRestaurantIds(), getFavoriteMenuItemIds()]);
      set({ restaurantIds, menuItemIds, loaded: true });
    } catch {
      set({ loaded: true }); // keep whatever we had; screens still render
    }
  },

  reset: () => set({ restaurantIds: [], menuItemIds: [], loaded: false }),

  // Optimistic: flip locally, then persist; roll back if the server rejects it.
  toggleRestaurant: async (id) => {
    const before = get().restaurantIds;
    const favorite = !before.includes(id);
    set({ restaurantIds: favorite ? [...before, id] : before.filter((x) => x !== id) });
    try {
      await setRestaurantFavorite(id, favorite);
    } catch {
      set({ restaurantIds: before });
    }
  },

  toggleMenuItem: async (id) => {
    const before = get().menuItemIds;
    const favorite = !before.includes(id);
    set({ menuItemIds: favorite ? [...before, id] : before.filter((x) => x !== id) });
    try {
      await setMenuItemFavorite(id, favorite);
    } catch {
      set({ menuItemIds: before });
    }
  },
}));
```

- [ ] **Step 10: Implement `lib/legacy-cleanup.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Sub-project 1 kept orders, addresses and favorites on the device and used a mock session.
// Those now live on the server, so the stale local copies are dropped once (not migrated).
const FLAG = "aaharam:migrated-v2";
const LEGACY_ASYNC_KEYS = [
  "aaharam:orders",
  "aaharam:order-request-ids",
  "aaharam:addresses",
  "aaharam:favorites:restaurants",
  "aaharam:favorites:items",
];
const LEGACY_SECURE_KEY = "aaharam:session";

export async function clearLegacyLocalData(): Promise<void> {
  if ((await AsyncStorage.getItem(FLAG)) === "true") return;
  await AsyncStorage.multiRemove(LEGACY_ASYNC_KEYS);
  await SecureStore.deleteItemAsync(LEGACY_SECURE_KEY).catch(() => undefined);
  await AsyncStorage.setItem(FLAG, "true");
}
```

- [ ] **Step 11: `app/_layout.tsx` — run cleanup and reset favorites on account changes**

Add imports:

```ts
import { clearLegacyLocalData } from "../lib/legacy-cleanup";
import { useFavoritesStore } from "../store/favorites-store";
```

In the hydration IIFE, before `const user = await getCurrentUser()...`, add `await clearLegacyLocalData().catch(() => undefined);`.

In the `onAuthStateChange` callback, add `useFavoritesStore.getState().reset();` as the first statement inside the `SIGNED_OUT` branch, and inside the `SIGNED_IN`/`USER_UPDATED` branch (before the `setTimeout`).

- [ ] **Step 12: Delete the unused seed files and fix the reorder test fixture**

```bash
git rm data/seed/orders.ts data/seed/addresses.ts
```

In `tests/reorder.test.ts`, replace the `sampleOrder` declaration with:

```ts
const sampleOrder: Order = {
  id: "ord1", restaurantId: "r1", restaurantName: restaurant.name,
  items: [{ menuItemId: "m1", name: "Paneer Biryani", quantity: 1, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
  status: "delivered", placedAt: "2026-09-01T00:00:00.000Z", statusUpdatedAt: "2026-09-01T00:08:00.000Z",
  address: {
    id: "addr1", label: "Home", recipientName: "Asha Rao", phone: "9876543210", line1: "12 MG Road",
    area: "Indiranagar", city: "Bengaluru", state: "Karnataka", postalCode: "560038", isDefault: true,
  },
  paymentMethod: "upi", paymentStatus: "paid_simulated",
  subtotal: 220, discount: 0, deliveryFee: 29, tax: 11, total: 260,
};
```

- [ ] **Step 13: Addresses screens**

`app/addresses/index.tsx`: change the import to `import { getAddresses, setDefaultAddress, deleteAddress } from "../../services/addresses";` and replace `saveAddress({ ...address, isDefault: true }).then(() => addressesQuery.refetch());` with `setDefaultAddress(address.id).then(() => addressesQuery.refetch());`.

`app/addresses/edit.tsx`: change the `@tanstack/react-query` import to `import { useQuery, useQueryClient } from "@tanstack/react-query";`, add `const queryClient = useQueryClient();` next to the existing `addressesQuery` line, change `id: existingId ?? \`addr${Date.now()}\`,` to `id: existingId ?? "",`, and directly after the `await saveAddress({...});` statement add `await queryClient.invalidateQueries({ queryKey: ["addresses"] });`.

- [ ] **Step 14: Order screens read the address snapshot**

`app/order-details/[orderId].tsx`: delete `import { getAddresses } from "../../services/addresses";` and replace

```ts
  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const address = addressesQuery.data?.find((a) => a.id === order?.addressId);
```

with:

```ts
  const address = order?.address;
```

`app/order-confirmation/[orderId].tsx`: same two edits (delete the `getAddresses` import; replace the two `addressesQuery`/`address` lines with `const address = order?.address;`).

- [ ] **Step 15: Home only loads orders for signed-in users** — in `app/(tabs)/home.tsx` change the orders query to:

```ts
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    enabled: !!user && !user.isGuest,
  });
```

- [ ] **Step 16: Keep `app/checkout/payment.tsx` compiling against the new `createOrder`** (Task 12 reworks this screen's error handling fully; no new imports are needed here). Replace the `createOrder({ ... })` call with:

```ts
      const order = await createOrder({
        clientRequestId,
        restaurantId: restaurant.id,
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, customization: l.customization })),
        couponCode: resolvedCoupon?.code ?? null,
        addressId: resolvedAddress.id,
        paymentMethod,
        deliveryInstructions: deliveryInstructions ?? null,
        expectedTotal: totals?.total ?? 0,
      });
```

- [ ] **Step 17: Stop the client-side tracking simulation** (it called the removed `updateOrderStatus`; the server job replaces it, and Task 11 finishes the screen). In `app/tracking/[orderId].tsx`:
  - change `import { getOrderById, updateOrderStatus } from "../../services/orders";` to `import { getOrderById } from "../../services/orders";`
  - delete `const SIMULATION_INTERVAL_MS = 8000;`
  - delete the `pushNotification` line, the `mountedRef` block (the `useRef` + its cleanup `useEffect`), and the entire `SIMULATED STATUS PROGRESSION` `useEffect`
  - remove now-unused imports (`useEffect`, `useRef`, `useNotificationsStore`, `nextStatus`) from that file.

- [ ] **Step 18: Run all checks**

Run: `npx jest` → all pass (order-errors 4, legacy-cleanup 2, the new mapper test, updated reorder tests).
Run: `npx tsc --noEmit` → exit 0. Run: `git grep -n "addressId\|updateOrderStatus" -- app services` → only `addressId:` inside `createOrder` input objects (payment screen) remains.

- [ ] **Step 19: Commit**

```bash
git add -A supabase/functions/_shared services store lib app data tests
git commit -m "feat: move addresses, favorites and orders to Supabase with server-created orders"
```

---

### Task 11: Notifications, Realtime sync, and server-driven tracking

**Files:**
- Modify: `supabase/functions/_shared/domain.ts` (`AppNotification`)
- Modify: `supabase/functions/_shared/mappers.ts` (`NotificationRow`, `notificationFromRow`)
- Create: `services/notifications.ts`
- Create: `hooks/useNotifications.ts`
- Create: `hooks/useRealtimeSync.ts`
- Modify: `app/_layout.tsx`
- Modify: `app/tracking/[orderId].tsx`
- Modify: `app/notifications/index.tsx` (rewrite)
- Modify: `app/(tabs)/home.tsx`, `app/(tabs)/profile.tsx`
- Modify: `features/orders/status.ts` (remove `nextStatus`)
- Delete: `store/notifications-store.ts`
- Test: `tests/mappers.test.ts` (notification case)

**Interfaces:**
- Consumes: `cancelOrder`, `getOrderById` (Task 10), `isCancellable` (Task 3), `supabase` (Task 7).
- Produces: `interface AppNotification { id: string; orderId?: string; title: string; body: string; createdAt: string; read: boolean }`; `getNotifications(): Promise<AppNotification[]>`; `markAllNotificationsRead(): Promise<void>`; `useNotifications(): { items; unreadCount; markAllRead; isLoading; signedIn }`; `useRealtimeSync(): void`; query key `["notifications"]`.

- [ ] **Step 1: Write the failing test** — append to `tests/mappers.test.ts` (add `notificationFromRow, NotificationRow` to the import):

```ts
describe("notificationFromRow", () => {
  it("derives `read` from read_at", () => {
    const row: NotificationRow = {
      id: "n1", user_id: "u1", order_id: "o1", title: "Out for delivery", body: "On its way!",
      read_at: null, created_at: "2026-10-12T12:06:00+00:00",
    };
    expect(notificationFromRow(row)).toEqual({
      id: "n1", orderId: "o1", title: "Out for delivery", body: "On its way!", createdAt: row.created_at, read: false,
    });
    expect(notificationFromRow({ ...row, order_id: null, read_at: "2026-10-12T12:07:00+00:00" })).toEqual({
      id: "n1", title: "Out for delivery", body: "On its way!", createdAt: row.created_at, read: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/mappers.test.ts`
Expected: FAIL — `notificationFromRow` is not exported.

- [ ] **Step 3: Add the type and mapper**

Append to `supabase/functions/_shared/domain.ts`:

```ts
export interface AppNotification {
  id: string;
  orderId?: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}
```

In `supabase/functions/_shared/mappers.ts`, add `AppNotification` to the domain import and append:

```ts
export interface NotificationRow {
  id: string;
  user_id: string;
  order_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export function notificationFromRow(n: NotificationRow): AppNotification {
  return {
    id: n.id,
    orderId: n.order_id ?? undefined,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    read: n.read_at !== null,
  };
}
```

Run: `npx jest tests/mappers.test.ts` → PASS.

- [ ] **Step 4: Create `services/notifications.ts`**

```ts
import { supabase } from "../lib/supabase";
import { AppNotification } from "../types/domain";
import { notificationFromRow, type NotificationRow } from "../supabase/functions/_shared/mappers";

export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as NotificationRow[]).map(notificationFromRow);
}

/** Clients may only set read_at (column-level grant); RLS limits this to the caller's rows. */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
```

- [ ] **Step 5: Create `hooks/useNotifications.ts`**

```ts
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead } from "../services/notifications";
import { useAuthStore } from "../store/auth-store";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const signedIn = !!user && !user.isGuest;
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["notifications"], queryFn: getNotifications, enabled: signedIn });
  const items = signedIn ? query.data ?? [] : [];
  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = useCallback(async () => {
    if (!signedIn || unreadCount === 0) return;
    await markAllNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [signedIn, unreadCount, queryClient]);

  return { items, unreadCount, markAllRead, isLoading: signedIn && query.isLoading, signedIn };
}
```

- [ ] **Step 6: Create `hooks/useRealtimeSync.ts`**

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";

// One Realtime channel per signed-in user. Row changes don't carry everything the screens
// need, so events simply invalidate the matching queries and TanStack Query refetches.
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userId = user && !user.isGuest ? user.id : null;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        const id = (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id;
        if (id) queryClient.invalidateQueries({ queryKey: ["order", id] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
```

- [ ] **Step 7: `app/_layout.tsx` — mount Realtime and app-focus refetching**

Change the react-native import to `import { View, Text, AppState } from "react-native";`, change the TanStack import to `import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";`, and add `import { useRealtimeSync } from "../hooks/useRealtimeSync";`.

Above `export default function RootLayout()`, add:

```tsx
function RealtimeSync() {
  useRealtimeSync();
  return null;
}
```

Inside `RootLayout()`, add another effect:

```ts
  // React Native has no window focus; tell TanStack Query when the app is foregrounded so
  // stale queries (e.g. an order whose Realtime update was missed) refetch automatically.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => sub.remove();
  }, []);
```

Render `<RealtimeSync />` as the first child inside `<QueryClientProvider client={queryClient}>`.

- [ ] **Step 8: Rewrite the tracking screen logic** — `app/tracking/[orderId].tsx`

Replace the import block's first eight lines and the `useNotificationsStore`/`status` imports so the imports read:

```tsx
import React from "react";
import { View, Text, ScrollView, Pressable, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, AlertTriangle, FlaskConical, Phone, HelpCircle, Clock, RotateCcw } from "lucide-react-native";
import { getOrderById, cancelOrder } from "../../services/orders";
import { getRestaurantById } from "../../services/restaurants";
import { TrackingTimeline } from "../../components/orders/TrackingTimeline";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatOrderDate } from "../../lib/formatting/datetime";
import { ORDER_STATUS_LABELS, isTerminalStatus } from "../../features/orders/status";
import { isCancellable } from "../../supabase/functions/_shared/place-order-core";
import { colors } from "../../constants/theme";
```

Delete `const SIMULATION_INTERVAL_MS = 8000;`, the `pushNotification` line, the `mountedRef` block, and the whole `SIMULATED STATUS PROGRESSION` `useEffect` (if not already removed in Task 10).

Replace the order query with:

```tsx
  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId as string),
    enabled: !!orderId,
    // Realtime normally pushes status changes; polling is the fallback if the socket drops.
    refetchInterval: (query) => {
      const current = query.state.data;
      return current && !isTerminalStatus(current.status) ? 30_000 : false;
    },
  });
  const order = orderQuery.data;

  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", orderId], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  function confirmCancel() {
    if (!order) return;
    Alert.alert(
      "Cancel this order?",
      order.paymentStatus === "paid_simulated"
        ? "Your simulated payment will be marked as refunded."
        : "The restaurant will be told not to prepare it.",
      [
        { text: "Keep order", style: "cancel" },
        { text: "Cancel order", style: "destructive", onPress: () => cancelMutation.mutate() },
      ]
    );
  }
```

(keep the existing `restaurantQuery` below it).

Replace the simulated-tracking caption `<Text …>` content with:

```tsx
            Simulated tracking (development mode) -- a server job advances this order every 30 seconds to
            demonstrate the flow. There is no real courier or live GPS behind this screen.
```

Directly after the `<Card className="mb-4 p-4"><TrackingTimeline status={order.status} /></Card>` block, add:

```tsx
        {order.paymentStatus === "refunded_simulated" ? (
          <View className="mb-4 flex-row items-center rounded-xl bg-primary/10 px-3 py-2.5">
            <RotateCcw size={16} color={colors.primary} />
            <Text className="ml-2 flex-1 text-xs font-semibold text-primary">Refund issued (simulated)</Text>
          </View>
        ) : null}

        {isCancellable(order.status) ? (
          <View className="mb-4">
            <Button
              title="Cancel order"
              variant="outline"
              loading={cancelMutation.isPending}
              onPress={confirmCancel}
              accessibilityLabel="Cancel this order"
            />
            {cancelMutation.error ? (
              <Text className="mt-2 text-xs text-danger">{(cancelMutation.error as Error).message}</Text>
            ) : null}
          </View>
        ) : null}
```

- [ ] **Step 9: Remove the now-unused `nextStatus`** from `features/orders/status.ts` (the comment and the function at the end of the file). Run `git grep -n "nextStatus"` → no output.

- [ ] **Step 10: Rewrite `app/notifications/index.tsx`**

```tsx
import React, { useEffect } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";
import { useNotifications } from "../../hooks/useNotifications";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { AppNotification } from "../../types/domain";
import { colors } from "../../constants/theme";

function Header({ topInset }: { topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        Notifications
      </Text>
    </View>
  );
}

// Lightweight "x minutes/hours/days ago" formatter -- no date library needed for this.
function relativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const content = (
    <View className="flex-row items-start px-4 py-3.5 border-b border-border">
      <View className={`mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-full ${notification.read ? "bg-border/60" : "bg-primary/10"}`}>
        <Bell size={16} color={notification.read ? colors.muted : colors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-2 text-sm font-semibold text-ink">{notification.title}</Text>
          {!notification.read ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
        </View>
        <Text className="mt-0.5 text-sm text-muted">{notification.body}</Text>
        <Text className="mt-1 text-xs text-muted">{relativeTime(notification.createdAt)}</Text>
      </View>
    </View>
  );
  if (!notification.orderId) return content;
  return (
    <Pressable onPress={() => router.push(`/tracking/${notification.orderId}`)} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { items, markAllRead, isLoading, signedIn } = useNotifications();

  // Opening this screen is the "I've seen my notifications" action, so the badges clear.
  useEffect(() => {
    markAllRead().catch(() => undefined);
  }, [markAllRead]);

  if (!signedIn) {
    return (
      <View className="flex-1 bg-bg">
        <Header topInset={insets.top} />
        <EmptyState
          icon={Bell}
          title="Sign in to get order updates"
          description="Status updates for your orders appear here."
          actionLabel="Sign in"
          onAction={() => router.push("/auth/login?returnTo=%2Fnotifications")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <Header topInset={insets.top} />
      {isLoading ? (
        <View className="px-4 py-2">
          <Skeleton width="100%" height={64} />
          <View className="mt-3">
            <Skeleton width="100%" height={64} />
          </View>
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="We'll let you know when there's something new." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 11: Badges use the hook; delete the old store**

`app/(tabs)/home.tsx` and `app/(tabs)/profile.tsx`: replace `import { useNotificationsStore } from "../../store/notifications-store";` with `import { useNotifications } from "../../hooks/useNotifications";`, and `const unreadCount = useNotificationsStore((s) => s.unreadCount);` with `const { unreadCount } = useNotifications();`.

```bash
git rm store/notifications-store.ts
```

Run: `git grep -n "notifications-store"` → no output.

- [ ] **Step 12: Run all checks**

Run: `npx jest` → all pass. Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 13: Commit**

```bash
git add -A supabase/functions/_shared services hooks app features store tests
git commit -m "feat: live order tracking and notifications via Supabase Realtime, with order cancellation"
```

---

### Task 12: Checkout and payment against the `place-order` contract

**Files:**
- Modify: `store/checkout-selection-store.ts`
- Modify: `app/checkout/payment.tsx`
- Modify: `app/checkout/index.tsx` (comments only)
- Modify: `app/cart/index.tsx`
- Modify: `components/cart/CartLineItem.tsx`

**Interfaces:**
- Consumes: `createOrder`, `OrderError` (Task 10); `PriceBreakdown`, `CartTotals`.
- Produces: `useCheckoutSelectionStore` gains `cartNotice: string | null`, `unavailableItemIds: string[]`, `setCartFeedback(notice: string | null, unavailableItemIds?: string[])`, `clearCartFeedback()`. `CartLineItemCard` gains optional prop `unavailable?: boolean`.

- [ ] **Step 1: Extend `store/checkout-selection-store.ts`** — replace the file:

```ts
import { create } from "zustand";

interface CheckoutSelectionState {
  selectedAddressId: string | null;
  paymentMethod: "upi" | "card" | "netbanking" | "cod";
  /** Message shown on the cart after place-order sends the user back (e.g. coupon invalid). */
  cartNotice: string | null;
  /** Items place-order reported as unavailable; the cart marks these lines. */
  unavailableItemIds: string[];
  setSelectedAddressId: (id: string) => void;
  setPaymentMethod: (method: CheckoutSelectionState["paymentMethod"]) => void;
  setCartFeedback: (notice: string | null, unavailableItemIds?: string[]) => void;
  clearCartFeedback: () => void;
}

export const useCheckoutSelectionStore = create<CheckoutSelectionState>((set) => ({
  selectedAddressId: null,
  paymentMethod: "upi",
  cartNotice: null,
  unavailableItemIds: [],
  setSelectedAddressId: (id) => set({ selectedAddressId: id }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setCartFeedback: (notice, unavailableItemIds = []) => set({ cartNotice: notice, unavailableItemIds }),
  clearCartFeedback: () => set({ cartNotice: null, unavailableItemIds: [] }),
}));
```

- [ ] **Step 2: `components/cart/CartLineItem.tsx` — mark unavailable lines**

Change the props interface to:

```ts
interface CartLineItemCardProps {
  line: CartLineItemModel;
  menuItem: MenuItem | undefined;
  unavailable?: boolean;
}
```

Change the signature to `export function CartLineItemCard({ line, menuItem, unavailable }: CartLineItemCardProps) {`. Directly after the special-instructions block (the `{line.customization.specialInstructions ? (...) : null}` expression), add:

```tsx
          {unavailable ? (
            <Text className="mt-1 text-xs font-semibold text-danger">No longer available - remove it to continue</Text>
          ) : null}
```

- [ ] **Step 3: `app/cart/index.tsx` — show server feedback and block checkout on unavailable lines**

Add `import { useCheckoutSelectionStore } from "../../store/checkout-selection-store";` and, with the other store reads at the top of `CartScreen()`:

```ts
  const cartNotice = useCheckoutSelectionStore((s) => s.cartNotice);
  const unavailableItemIds = useCheckoutSelectionStore((s) => s.unavailableItemIds);
  const clearCartFeedback = useCheckoutSelectionStore((s) => s.clearCartFeedback);
  const hasUnavailable = lines.some((l) => unavailableItemIds.includes(l.menuItemId));
```

Where the `FlatList` renders `CartLineItemCard`, pass `unavailable={unavailableItemIds.includes(item.menuItemId)}` (use the render callback's item variable name as it exists in the file).

At the top of the list header (the first child inside `ListHeaderComponent`'s root view), add:

```tsx
            {cartNotice ? (
              <View className="mb-3 flex-row items-start rounded-xl bg-danger/10 px-3 py-2.5">
                <AlertTriangle size={16} color={colors.danger} />
                <Text className="ml-2 flex-1 text-sm font-semibold text-danger">{cartNotice}</Text>
                <Pressable onPress={clearCartFeedback} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
                  <Text className="text-xs font-semibold text-danger">Dismiss</Text>
                </Pressable>
              </View>
            ) : null}
```

Change the checkout `Button`'s `title`, `disabled`, and `accessibilityLabel`:

```tsx
          title={
            hasUnavailable
              ? "Remove unavailable items"
              : belowMinOrder
              ? `Add ${formatCurrency(shortfall)} more to continue`
              : "Proceed to Checkout"
          }
          disabled={belowMinOrder || hasUnavailable}
          accessibilityLabel={
            hasUnavailable
              ? "Remove unavailable items to continue"
              : belowMinOrder
              ? `Minimum order not met, add ${formatCurrency(shortfall)} more`
              : "Proceed to Checkout"
          }
```

and make its `onPress` clear stale feedback before continuing:

```tsx
          onPress={() => {
            if (!requireSignIn("/checkout")) return;
            clearCartFeedback();
            router.push("/checkout");
          }}
```

- [ ] **Step 4: `app/checkout/payment.tsx` — handle every `place-order` outcome**

Imports: change `import { useQuery } from "@tanstack/react-query";` to `import { useQuery, useQueryClient } from "@tanstack/react-query";` and add:

```ts
import { OrderError } from "../../services/order-errors";
import { PriceBreakdown } from "../../components/cart/PriceBreakdown";
import { CartTotals } from "../../lib/pricing/calculate";
```

Replace the `deliveryInstructions` comment block above `const deliveryInstructions = params.instructions;` with:

```ts
  // The user's one-off note for THIS order, carried from checkout as a query string. It is sent
  // to place-order (stored on the order only) and never written back to the saved Address.
```

Change the phase state to include the price-change step, and add state for it, right where `phase` is declared:

```ts
  const [phase, setPhase] = useState<"idle" | "processing" | "error" | "price-changed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverTotals, setServerTotals] = useState<CartTotals | null>(null);
  const queryClient = useQueryClient();
```

(delete the old `phase`/`errorMessage` declarations).

Replace the whole `handleConfirm` function with:

```ts
  async function handleConfirm(acceptedTotal?: number) {
    if (submittingRef.current) return;
    if (!resolvedAddress || !restaurant || !clientRequestId || lines.length === 0 || !totals) return;
    if (restaurantClosed) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (paymentMethod !== "cod") {
        setPhase("processing");
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));
      }

      // Only IDs and choices are sent; place-order prices everything itself. expectedTotal is
      // what the user saw, so a server-side price change can never charge a surprise amount.
      const order = await createOrder({
        clientRequestId,
        restaurantId: restaurant.id,
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, customization: l.customization })),
        couponCode: resolvedCoupon?.code ?? null,
        addressId: resolvedAddress.id,
        paymentMethod,
        deliveryInstructions: deliveryInstructions ?? null,
        expectedTotal: acceptedTotal ?? totals.total,
      });

      useCartStore.getState().clearCart();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (!mountedRef.current) return;
      router.replace(`/order-confirmation/${order.id}`);
      // submittingRef stays true: this screen is leaving and must never fire createOrder again.
    } catch (err) {
      if (!mountedRef.current) return;
      submittingRef.current = false;
      setIsSubmitting(false);
      const error = err instanceof OrderError ? err : new OrderError("INTERNAL", "Something went wrong. Please try again.");
      const sendBackToCart = (notice: string, unavailableIds: string[] = []) => {
        useCheckoutSelectionStore.getState().setCartFeedback(notice, unavailableIds);
        queryClient.invalidateQueries({ queryKey: ["menu", restaurant.id] });
        queryClient.invalidateQueries({ queryKey: ["restaurant", restaurant.id] });
        router.dismissTo("/cart");
      };

      switch (error.code) {
        case "PRICE_CHANGED":
          setServerTotals((error.details?.totals as CartTotals | undefined) ?? null);
          setPhase("price-changed");
          queryClient.invalidateQueries({ queryKey: ["menu", restaurant.id] });
          return;
        case "ITEM_UNAVAILABLE":
          sendBackToCart(error.message, (error.details?.menuItemIds as string[] | undefined) ?? []);
          return;
        case "COUPON_INVALID":
          useCartStore.getState().removeCoupon();
          sendBackToCart(`Coupon removed: ${(error.details?.reason as string | undefined) ?? error.message}`);
          return;
        case "RESTAURANT_CLOSED":
        case "BELOW_MIN_ORDER":
          sendBackToCart(error.message);
          return;
        case "UNAUTHORIZED":
          router.push("/auth/login?returnTo=%2Fcheckout");
          return;
        default:
          // NETWORK / INTERNAL / INVALID_INPUT / NOT_FOUND: retry reuses the same clientRequestId,
          // so a retry after an ambiguous failure can never create a second order.
          setPhase("error");
          setErrorMessage(error.message);
      }
    }
  }
```

Every existing `onPress={handleConfirm}` must become `onPress={() => handleConfirm()}` (so the press event is not passed as `acceptedTotal`).

Directly above `{phase === "error" && errorMessage ? (`, add the price-change step:

```tsx
        {phase === "price-changed" && serverTotals ? (
          <Card className="mb-4 p-4">
            <Text className="text-sm font-bold text-ink">Prices have changed</Text>
            <Text className="mt-1 mb-3 text-xs text-muted">
              The restaurant updated its menu since you reviewed your order. Here's the new total:
            </Text>
            <PriceBreakdown totals={serverTotals} originalDeliveryFee={restaurant.deliveryFee} />
            <View className="mt-3">
              <Button
                title={`Confirm ${formatCurrency(serverTotals.total)}`}
                size="lg"
                loading={isSubmitting}
                onPress={() => handleConfirm(serverTotals.total)}
                accessibilityLabel={`Confirm new total ${formatCurrency(serverTotals.total)}`}
              />
            </View>
          </Card>
        ) : null}
```

Hide the main pay button while the price-change card is showing: change the ternary that renders the bottom buttons from `{phase === "error" ? (` … `) : (` … `)}` to wrap it as:

```tsx
        {phase === "price-changed" ? null : phase === "error" ? (
```

(keeping both existing branches unchanged otherwise).

If `router.dismissTo` is not available in the installed expo-router (TypeScript error), use `router.navigate("/cart")` instead and note it in the task report.

- [ ] **Step 5: `app/checkout/index.tsx` — update the now-stale comments**

Replace the comment block above `const [instructionsDraft, ...]` with:

```ts
  // Transient note for THIS checkout only -- never written back to the saved Address (a one-off
  // note like "leave with roommate today" must not become a standing property of "Home").
  // Seeded from the address's saved note and re-seeded when the address changes; carried to the
  // payment screen as a query string and sent to place-order, which stores it on the order.
```

and the comment inside `handlePlaceOrder` (the 4 lines starting `// instructionsDraft is intentionally NOT persisted`) with:

```ts
      // Carried as a query string like clientRequestId; payment.tsx sends it to place-order.
```

- [ ] **Step 6: Run all checks**

Run: `npx tsc --noEmit` → exit 0. Run: `npx jest` → all pass.

- [ ] **Step 7: Commit**

```bash
git add store/checkout-selection-store.ts app/checkout app/cart components/cart
git commit -m "feat: server-authoritative checkout with price-change, unavailable-item and coupon handling"
```

---

### Task 13: Verification scripts, owner setup guide, final sweep

**Files:**
- Create: `scripts/script-env.ts`
- Create: `scripts/verify-rls.ts`
- Create: `scripts/smoke-test.ts`
- Create: `.env.local.example`
- Create: `docs/backend-setup.md`
- Modify: `docs/superpowers/specs/2026-10-12-backend-auth-design.md` (record the deviations)

**Interfaces:**
- Consumes: everything above; `toOrderError` (Task 10); `calculateCartTotals`, mappers (Tasks 1–2).
- Produces: `npx tsx scripts/verify-rls.ts` and `npx tsx scripts/smoke-test.ts`, each printing `PASS`/`FAIL` lines and exiting non-zero on any failure.

- [ ] **Step 1: Create `scripts/script-env.ts`**

```ts
// Shared setup for the owner-run verification scripts (Node, not the app).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional file
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See docs/backend-setup.md.`);
    process.exit(1);
  }
  return value;
}

export const SUPABASE_URL = required("EXPO_PUBLIC_SUPABASE_URL");
export const ANON_KEY = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
export const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, noSession);
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Creates a confirmed throwaway user (no email is sent) and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `aaharam-${label}-${Date.now()}@example.com`;
  const password = `Pw-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser returned no user");
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (user) await admin.auth.admin.deleteUser(user.id);
}

let failures = 0;

export async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : JSON.stringify(err)}`);
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function finish(): never {
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
```

- [ ] **Step 2: Create `scripts/verify-rls.ts`**

```ts
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
```

- [ ] **Step 3: Create `scripts/smoke-test.ts`**

```ts
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
```

- [ ] **Step 4: Create `.env.local.example`**

```
# Copy to .env.local (git-ignored). Used ONLY by scripts/verify-rls.ts and scripts/smoke-test.ts,
# never by the app. Supabase dashboard -> Project Settings -> API -> service_role (or a secret key).
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
```

- [ ] **Step 5: Create `docs/backend-setup.md`**

````markdown
# AAHARAM backend setup (Supabase)

One-time steps to connect the app to your own free Supabase project. Run each command from
the project folder.

## 1. Create the project

1. Sign in at https://supabase.com and create a new project (free tier is fine).
2. Wait until it finishes provisioning.
3. In **Project Settings → API**, copy the **Project URL** and the **anon** (or `sb_publishable_…`) key.
4. Copy `.env.example` to `.env` and paste both values.

## 2. Link the CLI

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the part of the Project URL before `.supabase.co`.

## 3. Create the database and load the catalog

```bash
npx supabase db push --include-seed
```

This applies everything in `supabase/migrations/` (tables, security rules, tracking job,
Realtime) and loads `supabase/seed.sql`.

## 4. Deploy the server functions

```bash
npx supabase functions deploy --use-api
```

If your CLI version says `--use-api` is unknown, run it without that flag (newer CLIs deploy
without Docker by default).

## 5. Make sign-in emails contain the code

In **Authentication → Emails → Templates → Magic Link**, set:

- Subject: `Your AAHARAM sign-in code`
- Body:

```html
<h2>Your AAHARAM sign-in code</h2>
<p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
<p>It expires in 1 hour. If you didn't ask for it, you can ignore this email.</p>
```

The app accepts 6–8 digit codes, so the **Email OTP Length** setting can stay at its default.

## 6. (Optional) Let anyone sign in

Supabase's built-in email only delivers to members of your Supabase organization, about 2 per
hour. To let other people (for example recruiters) sign in, connect a free SMTP provider such as
Brevo under **Authentication → Emails → SMTP Settings**. No code changes are needed.

## 7. Run the app

```bash
npx expo start --clear
```

## 8. Verify the backend (optional but recommended)

Copy `.env.local.example` to `.env.local` and paste the **service_role** (or secret) key. Never
commit this file or put this key in the app.

```bash
npx tsx scripts/verify-rls.ts
```

```bash
npx tsx scripts/smoke-test.ts
```

Both print `PASS`/`FAIL` per check and clean up the throwaway users they create.

## Updating the catalog later

Edit `data/seed/*.ts`, then:

```bash
npx tsx scripts/generate-seed-sql.ts
```

```bash
npx supabase db push --include-seed
```
````

- [ ] **Step 6: Record the deviations in the spec** — in `docs/superpowers/specs/2026-10-12-backend-auth-design.md`:
  - §6 intro: replace "`verify_jwt = true` (default)" with "`verify_jwt = false`; the caller is verified in code with `auth.getUser(token)` (works with legacy and new API keys)".
  - §9: in the repository layout, change `services/{mappers,offers,notifications}.ts  # new` to `services/{offers,notifications,order-errors}.ts  # new` and add `_shared/mappers.ts, _shared/order-errors.ts` to the `_shared/` line; change `config.toml` comment to `verify_jwt = false`.
  - §8: replace the last sentence about `SEED_ADDRESSES`/`SEED_ORDERS` with "`data/seed/addresses.ts` and `data/seed/orders.ts` are deleted. Valid seed coupons now expire 2027-12-31."
  - §2/§4.4: replace any mention of `services/mappers.ts` with `supabase/functions/_shared/mappers.ts`.

- [ ] **Step 7: Final automated sweep**

Run: `npx tsc --noEmit` → exit 0.
Run: `npx jest` → all suites pass; record the totals.
Run: `npx expo export --platform android --output-dir "$TEMP/aaharam-export"` → completes.
Run: `git log main..HEAD --format=%B | grep -ic "co-authored-by"` → `0` (no attribution trailers on this branch).
Run: `git grep -n "data/seed" -- app components services store hooks features` → no output.

The hosted-project steps (`db push`, `functions deploy`, `verify-rls`, `smoke-test`, device checklist) are run by the owner using `docs/backend-setup.md`; report them as pending, not done.

- [ ] **Step 8: Commit**

```bash
git add scripts .env.local.example docs/backend-setup.md docs/superpowers/specs/2026-10-12-backend-auth-design.md
git commit -m "chore: add RLS and smoke-test scripts, backend setup guide, and record spec deviations"
```

---

## Manual device checklist (owner, after setup)

1. Fresh install → onboarding → **Continue as Guest** → browse, search, add to cart.
2. Cart → **Proceed to Checkout** → login screen ("Sign in to continue.") → enter email → code arrives → verify.
3. New account: "What should we call you?" → name saved → location step → back to checkout with the cart intact.
4. Add an address → place a UPI order → confirmation screen.
5. Open tracking and stay on it: status advances on its own (≈30 s, 1.5 min, 4 min…) without leaving the screen; Home bell badge increments.
6. Place a second order and cancel it while "placed"/"confirmed" → "Refund issued (simulated)".
7. Reorder from history.
8. Sign out → sign in with a second email → no orders, addresses, favorites or notifications from the first account.
