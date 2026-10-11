# CRAVE Sub-Project 1: Foundation + Customer UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional, locally-driven (no backend yet) React Native/Expo customer app for CRAVE — a food delivery brand — covering the entire ordering journey (browse → search → customize → cart → checkout → mock-pay → track → reorder → favorites) against rich seeded demo data, with mock auth/payment clearly labeled, so the app is genuinely usable end-to-end on a device/simulator today.

**Architecture:** Expo Router file-based navigation with a `(tabs)` group for the 5 primary tabs and modal/stack routes for everything else. A `services/` layer exposes async functions (`getRestaurants()`, `searchMenu()`, `createOrder()`, etc.) that currently read from in-memory seed data but have the exact async signatures a future Supabase-backed implementation will need (sub-project 2 swaps internals only). Zustand owns cart/favorites/preferences/auth-session client state (persisted via AsyncStorage/SecureStore); TanStack Query owns server-shaped reads through the `services/` layer so the data-fetching pattern doesn't change when the backend arrives.

**Tech Stack:** Expo SDK (latest stable), TypeScript, Expo Router, NativeWind, React Native Reanimated, React Native Gesture Handler, React Hook Form, Zod, TanStack Query, Zustand, Expo SecureStore, AsyncStorage, lucide-react-native.

**Spec:** This plan is self-contained (brainstorming classified the full user request as architectural and too large for one spec; this plan covers Sub-project 1 only — Foundation + Customer UI. See conversation history for the full 30-section source request and the 4-sub-project decomposition).

## Global Constraints

- Platform target: Android + iOS via Expo (no web-first shortcuts; no admin/dashboard product).
- Brand name "CRAVE" must be a single constant (`constants/brand.ts`), not hardcoded string literals, so it's renameable later.
- Colors/typography must come from `constants/theme.ts` design tokens — no raw hex in component files.
- All prices are INR, formatted via a single `formatCurrency` helper — no ad-hoc `₹${n}` string building.
- Every mock/dev-only integration (auth, payment, AI, tracking) must render a visible "Demo" / "Dev mode" label in the UI — never silently pretend to be real.
- No screen may crash on empty/loading/error data — every list-driven screen needs a skeleton, an empty state, and uses real seed data (never a hardcoded array duplicated in the component).
- Use FlatList (not ScrollView+map) for any list that can exceed ~10 items.
- Cart/favorites/preferences persist across app restart (AsyncStorage via Zustand `persist` middleware); auth session uses SecureStore.
- Server-shape discipline: anything that will eventually need server authority (pricing totals, coupon validation, order creation, reorder availability checks) must live behind an `async` function in `services/`, even though it's local-only today — never compute final payable total directly inside a component.
- Android hardware back button must behave correctly (Expo Router stacks handle this by default — do not suppress `BackHandler` without reason).

---

## File Structure

```
AAHARAM/
  app/
    _layout.tsx                      # Root stack: splash → onboarding → auth → (tabs); hides headers
    index.tsx                        # Splash screen (redirects based on first-launch/auth state)
    onboarding/
      index.tsx
    auth/
      _layout.tsx                    # stack, no tab bar
      login.tsx
      otp.tsx
      location-select.tsx
    (tabs)/
      _layout.tsx                    # bottom tab bar: Home, Explore, Orders, Favorites, Profile
      home.tsx
      explore.tsx
      orders.tsx
      favorites.tsx
      profile.tsx
    restaurant/
      [id].tsx
    food/
      [id].tsx
    search/
      index.tsx
    cart/
      index.tsx
    checkout/
      index.tsx
      payment.tsx
    addresses/
      index.tsx
      edit.tsx
    order-confirmation/
      [orderId].tsx
    tracking/
      [orderId].tsx
    order-details/
      [orderId].tsx
    assistant/
      index.tsx
    notifications/
      index.tsx
    profile/
      edit.tsx
      settings.tsx
      help.tsx
  components/
    ui/
      Button.tsx
      Card.tsx
      Badge.tsx
      TextField.tsx
      Skeleton.tsx
      EmptyState.tsx
      RatingPill.tsx
      QuantityStepper.tsx
      SectionHeader.tsx
    home/
      CategoryCard.tsx
      RestaurantCard.tsx
      FoodCard.tsx
      HorizontalCarousel.tsx
    restaurant/
      MenuCategoryBar.tsx
      MenuItemRow.tsx
    food/
      CustomizationSheet.tsx
    cart/
      CartLineItem.tsx
      CouponRow.tsx
      PriceBreakdown.tsx
    orders/
      OrderCard.tsx
      TrackingTimeline.tsx
    assistant/
      ChatBubble.tsx
      ResultCard.tsx
  features/
    restaurants/
      types.ts
    search/
      filters.ts
    cart/
      cart-types.ts
    checkout/
      coupon-rules.ts
    orders/
      reorder.ts
    recommendations/
      recommend.ts
  services/
    restaurants.ts
    search.ts
    orders.ts
    coupons.ts
    auth.ts
    addresses.ts
    favorites.ts
    assistant.ts
  store/
    cart-store.ts
    favorites-store.ts
    preferences-store.ts
    auth-store.ts
    notifications-store.ts
  lib/
    pricing/
      calculate.ts
    formatting/
      currency.ts
      datetime.ts
    validation/
      schemas.ts
  constants/
    brand.ts
    theme.ts
  data/
    seed/
      restaurants.ts
      menu-items.ts
      categories.ts
      offers.ts
      orders.ts
      addresses.ts
  types/
    domain.ts
  tests/
    pricing.test.ts
    cart-store.test.ts
    coupons.test.ts
    search-filters.test.ts
    reorder.test.ts
```

---

### Task 1: Project Scaffold, TypeScript, Dependencies, Design Tokens

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `tailwind.config.js`, `global.css` (or `nativewind-env.d.ts` per installed NativeWind version)
- Create: `constants/brand.ts`
- Create: `constants/theme.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: `BRAND_NAME: string`, `BRAND_TAGLINE: string` from `constants/brand.ts`
- Produces: `colors`, `spacing`, `radii`, `fontSize` tokens from `constants/theme.ts`, typed as `export const colors = {...} as const`

- [ ] **Step 1: Initialize Expo project**

```bash
cd "C:\Users\chitt\Projects\AAHARAM"
npx create-expo-app@latest . --template blank-typescript
```

- [ ] **Step 2: Install navigation, styling, state, and form dependencies at Expo-SDK-compatible versions**

```bash
npx expo install expo-router expo-secure-store expo-linking expo-constants expo-status-bar expo-splash-screen expo-location expo-notifications react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated @react-native-async-storage/async-storage react-native-svg
npm install nativewind tailwindcss zustand @tanstack/react-query react-hook-form zod @hookform/resolvers lucide-react-native
```

Run `npx expo install --check` afterward and accept any version corrections Expo suggests — do not manually pin versions that conflict with the installed SDK.

- [ ] **Step 3: Configure Expo Router as the entry point**

In `app.json`, under `expo`, set:

```json
{
  "expo": {
    "scheme": "crave",
    "plugins": ["expo-router"],
    "newArchEnabled": true
  }
}
```

Update `package.json` `"main"` field to `"expo-router/entry"`.

- [ ] **Step 4: Configure NativeWind**

Create `tailwind.config.js`:

```js
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#FF5A36",
        "primary-deep": "#E94B2B",
        bg: "#FFF9F4",
        card: "#FFFFFF",
        ink: "#202020",
        muted: "#777777",
        border: "#F0E7E0",
        success: "#198754",
      },
    },
  },
  plugins: [],
};
```

Follow the installed NativeWind version's babel/metro setup instructions exactly (create `babel.config.js` with the nativewind babel preset and `metro.config.js` with `withNativeWind`, and a `global.css` imported from the root layout if the installed version requires it).

- [ ] **Step 5: Create design tokens**

`constants/brand.ts`:

```ts
export const BRAND_NAME = "CRAVE";
export const BRAND_TAGLINE = "Food Delivered Better";
export const ASSISTANT_NAME = "Crave AI";
```

`constants/theme.ts`:

```ts
export const colors = {
  primary: "#FF5A36",
  primaryDeep: "#E94B2B",
  bg: "#FFF9F4",
  card: "#FFFFFF",
  ink: "#202020",
  muted: "#777777",
  border: "#F0E7E0",
  success: "#198754",
  danger: "#D64545",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radii = { sm: 8, md: 14, lg: 20, full: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;
```

- [ ] **Step 6: Verify the app boots**

```bash
npx expo start --clear
```

Expected: Metro bundler starts with no config errors (press `w` or scan the QR code to confirm a blank screen renders without red-box errors).

- [ ] **Step 7: Commit**

```bash
git init
git add package.json app.json tsconfig.json babel.config.js tailwind.config.js metro.config.js constants/brand.ts constants/theme.ts .gitignore
git commit -m "chore: scaffold Expo Router + NativeWind project with design tokens"
```

---

### Task 2: Domain Types

**Files:**
- Create: `types/domain.ts`

**Interfaces:**
- Produces: `Restaurant`, `MenuCategory`, `MenuItem`, `ItemOptionGroup`, `ItemOption`, `AddOn`, `SpiceLevel`, `Offer`, `Coupon`, `Address`, `CartLineItem`, `CartCustomization`, `Order`, `OrderStatus`, `OrderItem`, `PaymentMethod`, `User` — every later task imports from here, no duplicate shape definitions anywhere else.

- [ ] **Step 1: Write the types**

```ts
// types/domain.ts

export type VegFlag = "veg" | "non-veg" | "egg" | "unknown";
export type SpiceLevel = "mild" | "medium" | "spicy";

export interface AddOn {
  id: string;
  name: string;
  priceDelta: number; // INR, can be 0
}

export interface ItemOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface ItemOptionGroup {
  id: string;
  name: string; // e.g. "Size"
  required: boolean;
  options: ItemOption[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  basePrice: number;
  vegFlag: VegFlag;
  rating?: number;
  isAvailable: boolean;
  optionGroups: ItemOptionGroup[];
  addOns: AddOn[];
  supportsSpiceLevel: boolean;
  popular?: boolean;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface OperatingHours {
  opensAt: string; // "10:00"
  closesAt: string; // "23:00"
}

export interface Restaurant {
  id: string;
  name: string;
  cuisines: string[];
  coverImageUrl: string;
  rating: number;
  ratingCount: number;
  priceRange: 1 | 2 | 3; // ₹ / ₹₹ / ₹₹₹
  etaMinutes: number;
  deliveryFee: number;
  minOrderAmount: number;
  isOpen: boolean;
  operatingHours: OperatingHours;
  offerIds: string[];
  tags: string[]; // "Trending", "Top Rated", "Quick Delivery", "Budget"
}

export interface Offer {
  id: string;
  restaurantId?: string; // undefined = platform-wide
  title: string;
  description: string;
  couponCode?: string;
}

export interface Coupon {
  code: string;
  description: string;
  type: "percentage" | "fixed" | "free-delivery";
  value: number; // percentage points or INR amount; ignored for free-delivery
  minOrderAmount: number;
  maxDiscount?: number;
  restaurantId?: string;
  expiresAt: string; // ISO date
}

export interface Address {
  id: string;
  label: "Home" | "Work" | "Other";
  recipientName: string;
  phone: string;
  line1: string;
  area: string;
  city: string;
  state: string;
  postalCode: string;
  landmark?: string;
  instructions?: string;
  isDefault: boolean;
  lat?: number;
  lng?: number;
}

export interface CartCustomization {
  optionSelections: Record<string, string>; // optionGroupId -> optionId
  addOnIds: string[];
  spiceLevel?: SpiceLevel;
  specialInstructions?: string;
}

export interface CartLineItem {
  lineId: string; // uuid, unique per distinct customization
  menuItemId: string;
  restaurantId: string;
  quantity: number;
  customization: CartCustomization;
  unitPrice: number; // snapshot at add-time, recalculated server-side at checkout
}

export type PaymentMethod = "upi" | "card" | "netbanking" | "cod";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "failed";

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customization: CartCustomization;
}

export interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  status: OrderStatus;
  placedAt: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  couponCode?: string;
  etaMinutes?: number;
}

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  isGuest: boolean;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors (file has no imports to break).

- [ ] **Step 3: Commit**

```bash
git add types/domain.ts
git commit -m "feat: add domain types for restaurants, menu, cart, and orders"
```

---

### Task 3: Seed Data

**Files:**
- Create: `data/seed/restaurants.ts`
- Create: `data/seed/categories.ts`
- Create: `data/seed/menu-items.ts`
- Create: `data/seed/offers.ts`
- Create: `data/seed/addresses.ts`
- Create: `data/seed/orders.ts`
- Test: `tests/seed-data.test.ts`

**Interfaces:**
- Consumes: types from `types/domain.ts` (Task 2)
- Produces: `SEED_RESTAURANTS: Restaurant[]`, `SEED_CATEGORIES: MenuCategory[]`, `SEED_MENU_ITEMS: MenuItem[]`, `SEED_OFFERS: Offer[]`, `SEED_COUPONS: Coupon[]`, `SEED_ADDRESSES: Address[]`, `SEED_ORDERS: Order[]` — every `services/*` function (Task 4+) reads these exclusively.

- [ ] **Step 1: Write the failing test asserting seed-data shape and minimums**

```ts
// tests/seed-data.test.ts
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_CATEGORIES } from "../data/seed/categories";

describe("seed data", () => {
  it("has at least 12 restaurants", () => {
    expect(SEED_RESTAURANTS.length).toBeGreaterThanOrEqual(12);
  });

  it("has at least 50 menu items", () => {
    expect(SEED_MENU_ITEMS.length).toBeGreaterThanOrEqual(50);
  });

  it("every menu item references an existing restaurant and category", () => {
    const restaurantIds = new Set(SEED_RESTAURANTS.map((r) => r.id));
    const categoryIds = new Set(SEED_CATEGORIES.map((c) => c.id));
    for (const item of SEED_MENU_ITEMS) {
      expect(restaurantIds.has(item.restaurantId)).toBe(true);
      expect(categoryIds.has(item.categoryId)).toBe(true);
    }
  });

  it("every restaurant has at least one menu item", () => {
    const covered = new Set(SEED_MENU_ITEMS.map((i) => i.restaurantId));
    for (const r of SEED_RESTAURANTS) {
      expect(covered.has(r.id)).toBe(true);
    }
  });

  it("includes both veg and non-veg items", () => {
    const flags = new Set(SEED_MENU_ITEMS.map((i) => i.vegFlag));
    expect(flags.has("veg")).toBe(true);
    expect(flags.has("non-veg")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/seed-data.test.ts
```

Expected: FAIL — cannot find module `../data/seed/restaurants` (file doesn't exist yet).

- [ ] **Step 3: Write `data/seed/restaurants.ts`**

Create 12+ restaurants spanning Indian cuisines (Biryani, North Indian, South Indian, Chinese, Pizza, Burgers, Desserts, Street Food, Healthy, Beverages), varied `priceRange` (1–3), `rating` (3.8–4.8), `etaMinutes` (20–55), `deliveryFee` (0, 20, 29, 39), `minOrderAmount` (0–149), mixed `isOpen`, and `tags` drawn from `["Trending", "Top Rated", "Quick Delivery", "Budget Friendly"]`. Use royalty-free Unsplash food-photography URLs (e.g. `https://images.unsplash.com/photo-XXXX?auto=format&fit=crop&w=800&q=80`) for `coverImageUrl` — pick distinct, real, resolvable Unsplash photo IDs per restaurant (no two restaurants share an image). Example entries (continue this pattern to 12+):

```ts
import { Restaurant } from "../../types/domain";

export const SEED_RESTAURANTS: Restaurant[] = [
  {
    id: "r1",
    name: "Biryani Junction",
    cuisines: ["Biryani", "North Indian"],
    coverImageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
    rating: 4.5,
    ratingCount: 2300,
    priceRange: 2,
    etaMinutes: 35,
    deliveryFee: 29,
    minOrderAmount: 99,
    isOpen: true,
    operatingHours: { opensAt: "11:00", closesAt: "23:30" },
    offerIds: ["o1"],
    tags: ["Trending", "Top Rated"],
  },
  {
    id: "r2",
    name: "Spice Route Chinese",
    cuisines: ["Chinese"],
    coverImageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
    rating: 4.2,
    ratingCount: 980,
    priceRange: 2,
    etaMinutes: 30,
    deliveryFee: 20,
    minOrderAmount: 0,
    isOpen: true,
    operatingHours: { opensAt: "12:00", closesAt: "23:00" },
    offerIds: [],
    tags: ["Quick Delivery"],
  },
  // ... continue to at least 12 entries, covering Pizza, Burgers, South Indian,
  // Desserts, Street Food, Healthy, Beverages, plus one explicitly isOpen:false
  // restaurant to exercise the "closed" UI state.
];
```

Implementer must add the remaining 10 restaurants following this exact field pattern, ensuring: at least one `isOpen: false`, at least one `minOrderAmount` > 0 for min-order UI, price ranges spread across 1/2/3.

- [ ] **Step 4: Write `data/seed/categories.ts`**

```ts
import { MenuCategory } from "../../types/domain";

export const SEED_CATEGORIES: MenuCategory[] = [
  { id: "c1", restaurantId: "r1", name: "Biryani", sortOrder: 0 },
  { id: "c2", restaurantId: "r1", name: "Starters", sortOrder: 1 },
  { id: "c3", restaurantId: "r1", name: "Beverages", sortOrder: 2 },
  { id: "c4", restaurantId: "r2", name: "Soups", sortOrder: 0 },
  { id: "c5", restaurantId: "r2", name: "Main Course", sortOrder: 1 },
  // continue: 2-3 categories per restaurant, ids unique across the whole file
];
```

- [ ] **Step 5: Write `data/seed/menu-items.ts`**

Create 50+ items distributed across all restaurants/categories. Give at least 6 items option groups + add-ons (to exercise customization), the rest simpler. Example:

```ts
import { MenuItem } from "../../types/domain";

export const SEED_MENU_ITEMS: MenuItem[] = [
  {
    id: "m1",
    restaurantId: "r1",
    categoryId: "c1",
    name: "Paneer Biryani",
    description: "Fragrant basmati rice layered with marinated paneer and whole spices.",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80",
    basePrice: 220,
    vegFlag: "veg",
    rating: 4.4,
    isAvailable: true,
    optionGroups: [
      {
        id: "og1",
        name: "Size",
        required: true,
        options: [
          { id: "opt1", label: "Regular", priceDelta: 0 },
          { id: "opt2", label: "Large", priceDelta: 60 },
        ],
      },
    ],
    addOns: [
      { id: "a1", name: "Extra Paneer", priceDelta: 40 },
      { id: "a2", name: "Raita", priceDelta: 25 },
    ],
    supportsSpiceLevel: true,
    popular: true,
  },
  // ... continue to at least 50 items across all restaurants/categories
];
```

Implementer must populate the remaining items so every restaurant from Task 3 Step 3 has >=3 items, covering veg/non-veg/egg flags, `isAvailable: false` on at least 2 items (to exercise "unavailable" UI), and `popular: true` on at least 8 items spread across restaurants (to drive "Trending Dishes").

- [ ] **Step 6: Write `data/seed/offers.ts`**

```ts
import { Offer, Coupon } from "../../types/domain";

export const SEED_OFFERS: Offer[] = [
  { id: "o1", restaurantId: "r1", title: "20% OFF", description: "Up to ₹100 off on orders above ₹299", couponCode: "BIRYANI20" },
  { id: "o2", title: "Free Delivery", description: "On your first order", couponCode: "FIRSTFREE" },
  // continue with a handful more
];

export const SEED_COUPONS: Coupon[] = [
  { code: "BIRYANI20", description: "20% off up to ₹100", type: "percentage", value: 20, minOrderAmount: 299, maxDiscount: 100, restaurantId: "r1", expiresAt: "2026-12-31" },
  { code: "FIRSTFREE", description: "Free delivery on first order", type: "free-delivery", value: 0, minOrderAmount: 0, expiresAt: "2026-12-31" },
  { code: "FLAT50", description: "Flat ₹50 off orders above ₹199", type: "fixed", value: 50, minOrderAmount: 199, expiresAt: "2026-11-30" },
  { code: "EXPIRED10", description: "Expired test coupon", type: "percentage", value: 10, minOrderAmount: 0, expiresAt: "2025-01-01" },
];
```

- [ ] **Step 7: Write `data/seed/addresses.ts`** (sample saved addresses for the demo user, used to seed local storage on first run)

```ts
import { Address } from "../../types/domain";

export const SEED_ADDRESSES: Address[] = [
  {
    id: "addr1",
    label: "Home",
    recipientName: "Demo User",
    phone: "9876543210",
    line1: "Flat 302, Palm Residency",
    area: "Koramangala 5th Block",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560095",
    landmark: "Near Forum Mall",
    isDefault: true,
  },
  {
    id: "addr2",
    label: "Work",
    recipientName: "Demo User",
    phone: "9876543210",
    line1: "WeWork, 3rd Floor",
    area: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    isDefault: false,
  },
];
```

- [ ] **Step 8: Write `data/seed/orders.ts`** (sample order history for the demo user)

```ts
import { Order } from "../../types/domain";

export const SEED_ORDERS: Order[] = [
  {
    id: "ord1001",
    restaurantId: "r1",
    restaurantName: "Biryani Junction",
    items: [
      { menuItemId: "m1", name: "Paneer Biryani", quantity: 2, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } },
    ],
    status: "delivered",
    placedAt: "2026-09-28T19:30:00.000Z",
    addressId: "addr1",
    paymentMethod: "upi",
    subtotal: 440,
    discount: 0,
    deliveryFee: 29,
    tax: 22,
    total: 491,
  },
  // add 2-3 more historical orders with varied statuses: one "cancelled", one "delivered" from a different restaurant
];
```

- [ ] **Step 9: Run test to verify it passes**

```bash
npx jest tests/seed-data.test.ts
```

Expected: PASS (5/5 tests)

- [ ] **Step 10: Commit**

```bash
git add data/seed tests/seed-data.test.ts
git commit -m "feat: add seed data for restaurants, menu, offers, addresses, and orders"
```

---

### Task 4: Pricing Module

**Files:**
- Create: `lib/pricing/calculate.ts`
- Create: `lib/formatting/currency.ts`
- Test: `tests/pricing.test.ts`

**Interfaces:**
- Consumes: `CartLineItem`, `MenuItem`, `Coupon` from `types/domain.ts`
- Produces: `calculateLineItemPrice(item: MenuItem, customization: CartCustomization): number`, `calculateCartTotals(lines: CartLineItem[], menuItems: MenuItem[], restaurant: Restaurant, coupon: Coupon | null): CartTotals` where `CartTotals = { subtotal: number; discount: number; deliveryFee: number; tax: number; total: number; freeDelivery: boolean }`. `formatCurrency(amount: number): string` → `"₹220"`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/pricing.test.ts
import { calculateLineItemPrice, calculateCartTotals } from "../lib/pricing/calculate";
import { formatCurrency } from "../lib/formatting/currency";
import { SEED_MENU_ITEMS, } from "../data/seed/menu-items";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_COUPONS } from "../data/seed/offers";
import { CartLineItem } from "../types/domain";

const paneerBiryani = SEED_MENU_ITEMS.find((i) => i.id === "m1")!;
const restaurant = SEED_RESTAURANTS.find((r) => r.id === "r1")!;

describe("calculateLineItemPrice", () => {
  it("adds option price deltas", () => {
    const price = calculateLineItemPrice(paneerBiryani, {
      optionSelections: { og1: "opt2" }, // Large +60
      addOnIds: [],
    });
    expect(price).toBe(280); // 220 + 60
  });

  it("adds add-on price deltas", () => {
    const price = calculateLineItemPrice(paneerBiryani, {
      optionSelections: { og1: "opt1" },
      addOnIds: ["a1", "a2"], // +40 +25
    });
    expect(price).toBe(285); // 220 + 0 + 40 + 25
  });
});

describe("calculateCartTotals", () => {
  const lines: CartLineItem[] = [
    {
      lineId: "l1",
      menuItemId: "m1",
      restaurantId: "r1",
      quantity: 2,
      customization: { optionSelections: { og1: "opt1" }, addOnIds: [] },
      unitPrice: 220,
    },
  ];

  it("computes subtotal, delivery fee, tax, and total with no coupon", () => {
    const totals = calculateCartTotals(lines, SEED_MENU_ITEMS, restaurant, null);
    expect(totals.subtotal).toBe(440);
    expect(totals.deliveryFee).toBe(29);
    expect(totals.discount).toBe(0);
    expect(totals.tax).toBe(Math.round(440 * 0.05));
    expect(totals.total).toBe(totals.subtotal - totals.discount + totals.deliveryFee + totals.tax);
  });

  it("applies a percentage coupon capped at maxDiscount", () => {
    const coupon = SEED_COUPONS.find((c) => c.code === "BIRYANI20")!;
    const totals = calculateCartTotals(lines, SEED_MENU_ITEMS, restaurant, coupon);
    expect(totals.discount).toBe(88); // 20% of 440 = 88, under max 100
  });

  it("applies free-delivery coupon by zeroing delivery fee", () => {
    const coupon = SEED_COUPONS.find((c) => c.code === "FIRSTFREE")!;
    const totals = calculateCartTotals(lines, SEED_MENU_ITEMS, restaurant, coupon);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.freeDelivery).toBe(true);
  });
});

describe("formatCurrency", () => {
  it("formats whole rupees with the ₹ symbol and no decimals", () => {
    expect(formatCurrency(220)).toBe("₹220");
    expect(formatCurrency(1299)).toBe("₹1,299");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/pricing.test.ts
```

Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `lib/formatting/currency.ts`**

```ts
export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
```

- [ ] **Step 4: Implement `lib/pricing/calculate.ts`**

```ts
import { CartCustomization, CartLineItem, Coupon, MenuItem, Restaurant } from "../../types/domain";

const TAX_RATE = 0.05;

export function calculateLineItemPrice(item: MenuItem, customization: CartCustomization): number {
  let price = item.basePrice;

  for (const group of item.optionGroups) {
    const selectedOptionId = customization.optionSelections[group.id];
    const option = group.options.find((o) => o.id === selectedOptionId);
    if (option) price += option.priceDelta;
  }

  for (const addOnId of customization.addOnIds) {
    const addOn = item.addOns.find((a) => a.id === addOnId);
    if (addOn) price += addOn.priceDelta;
  }

  return price;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  freeDelivery: boolean;
}

export function calculateCartTotals(
  lines: CartLineItem[],
  menuItems: MenuItem[],
  restaurant: Restaurant,
  coupon: Coupon | null
): CartTotals {
  const subtotal = lines.reduce((sum, line) => {
    const item = menuItems.find((m) => m.id === line.menuItemId);
    if (!item) return sum;
    return sum + calculateLineItemPrice(item, line.customization) * line.quantity;
  }, 0);

  let discount = 0;
  let freeDelivery = false;

  if (coupon && subtotal >= coupon.minOrderAmount) {
    if (coupon.type === "percentage") {
      discount = Math.round((subtotal * coupon.value) / 100);
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === "fixed") {
      discount = Math.min(coupon.value, subtotal);
    } else if (coupon.type === "free-delivery") {
      freeDelivery = true;
    }
  }

  const deliveryFee = freeDelivery ? 0 : restaurant.deliveryFee;
  const tax = Math.round((subtotal - discount) * TAX_RATE);
  const total = subtotal - discount + deliveryFee + tax;

  return { subtotal, discount, deliveryFee, tax, total, freeDelivery };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/pricing.test.ts
```

Expected: PASS (6/6 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/pricing lib/formatting tests/pricing.test.ts
git commit -m "feat: add cart pricing calculation and currency formatting"
```

---

### Task 5: Services Layer (restaurants, search, coupons, addresses, favorites, orders, auth)

**Files:**
- Create: `services/restaurants.ts`
- Create: `services/search.ts`
- Create: `services/coupons.ts`
- Create: `services/addresses.ts`
- Create: `services/favorites.ts`
- Create: `services/orders.ts`
- Create: `services/auth.ts`
- Create: `features/search/filters.ts`
- Test: `tests/search-filters.test.ts`
- Test: `tests/coupons.test.ts`

**Interfaces:**
- Consumes: seed data (Task 3), `calculateCartTotals` (Task 4)
- Produces:
  - `getRestaurants(): Promise<Restaurant[]>`
  - `getRestaurantById(id: string): Promise<Restaurant | null>`
  - `getMenuForRestaurant(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }>`
  - `searchAll(query: string): Promise<{ restaurants: Restaurant[]; items: MenuItem[] }>`
  - `filterRestaurants(restaurants: Restaurant[], filters: RestaurantFilters): Restaurant[]` (pure, sync, in `features/search/filters.ts`)
  - `validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<{ ok: true; coupon: Coupon } | { ok: false; reason: string }>`
  - `getAddresses(): Promise<Address[]>`, `saveAddress(addr: Address): Promise<void>`, `deleteAddress(id: string): Promise<void>`
  - `getFavoriteRestaurantIds(): Promise<string[]>`, `getFavoriteMenuItemIds(): Promise<string[]>`, `toggleFavoriteRestaurant(id: string): Promise<boolean>`, `toggleFavoriteMenuItem(id: string): Promise<boolean>`
  - `getOrders(): Promise<Order[]>`, `getOrderById(id: string): Promise<Order | null>`, `createOrder(input: CreateOrderInput): Promise<Order>` (idempotent via `clientRequestId`)
  - `signInAsGuest(): Promise<User>`, `requestOtp(phone: string): Promise<{ devOtp: string }>`, `verifyOtp(phone: string, code: string): Promise<User>`, `signOut(): Promise<void>`, `getCurrentUser(): Promise<User | null>`

- [ ] **Step 1: Write failing test for filter logic**

```ts
// tests/search-filters.test.ts
import { filterRestaurants } from "../features/search/filters";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";

describe("filterRestaurants", () => {
  it("filters by cuisine", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { cuisine: "Chinese" });
    expect(result.every((r) => r.cuisines.includes("Chinese"))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by minimum rating", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { minRating: 4.5 });
    expect(result.every((r) => r.rating >= 4.5)).toBe(true);
  });

  it("filters by max price range", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { maxPriceRange: 1 });
    expect(result.every((r) => r.priceRange === 1)).toBe(true);
  });

  it("filters by max delivery time", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { maxEtaMinutes: 30 });
    expect(result.every((r) => r.etaMinutes <= 30)).toBe(true);
  });

  it("sorts by rating descending when requested", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, { sortBy: "rating" });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].rating).toBeGreaterThanOrEqual(result[i].rating);
    }
  });

  it("returns all restaurants when no filters are applied", () => {
    const result = filterRestaurants(SEED_RESTAURANTS, {});
    expect(result.length).toBe(SEED_RESTAURANTS.length);
  });
});
```

```ts
// tests/coupons.test.ts
import { validateCoupon } from "../services/coupons";

describe("validateCoupon", () => {
  it("rejects an unknown code", async () => {
    const result = await validateCoupon("NOTREAL", 500, "r1");
    expect(result.ok).toBe(false);
  });

  it("rejects when subtotal is below minOrderAmount", async () => {
    const result = await validateCoupon("BIRYANI20", 100, "r1");
    expect(result.ok).toBe(false);
  });

  it("rejects an expired coupon", async () => {
    const result = await validateCoupon("EXPIRED10", 500, "r1");
    expect(result.ok).toBe(false);
  });

  it("rejects a restaurant-specific coupon used at a different restaurant", async () => {
    const result = await validateCoupon("BIRYANI20", 500, "r2");
    expect(result.ok).toBe(false);
  });

  it("accepts a valid matching coupon", async () => {
    const result = await validateCoupon("BIRYANI20", 500, "r1");
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/search-filters.test.ts tests/coupons.test.ts
```

Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `features/search/filters.ts`**

```ts
import { Restaurant } from "../../types/domain";

export interface RestaurantFilters {
  cuisine?: string;
  minRating?: number;
  maxPriceRange?: 1 | 2 | 3;
  maxEtaMinutes?: number;
  vegOnly?: boolean; // reserved: menu-level veg filtering happens at item level (Task 11)
  sortBy?: "rating" | "price" | "eta" | "relevance";
}

export function filterRestaurants(restaurants: Restaurant[], filters: RestaurantFilters): Restaurant[] {
  let result = restaurants.filter((r) => {
    if (filters.cuisine && !r.cuisines.includes(filters.cuisine)) return false;
    if (filters.minRating && r.rating < filters.minRating) return false;
    if (filters.maxPriceRange && r.priceRange > filters.maxPriceRange) return false;
    if (filters.maxEtaMinutes && r.etaMinutes > filters.maxEtaMinutes) return false;
    return true;
  });

  if (filters.sortBy === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
  if (filters.sortBy === "price") result = [...result].sort((a, b) => a.priceRange - b.priceRange);
  if (filters.sortBy === "eta") result = [...result].sort((a, b) => a.etaMinutes - b.etaMinutes);

  return result;
}
```

- [ ] **Step 4: Implement `services/restaurants.ts`**

```ts
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_CATEGORIES } from "../data/seed/categories";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Restaurant, MenuCategory, MenuItem } from "../types/domain";

const SIMULATED_LATENCY_MS = 250;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), SIMULATED_LATENCY_MS));
}

export async function getRestaurants(): Promise<Restaurant[]> {
  return delay(SEED_RESTAURANTS);
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  return delay(SEED_RESTAURANTS.find((r) => r.id === id) ?? null);
}

export async function getMenuForRestaurant(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  return delay({
    categories: SEED_CATEGORIES.filter((c) => c.restaurantId === restaurantId).sort((a, b) => a.sortOrder - b.sortOrder),
    items: SEED_MENU_ITEMS.filter((i) => i.restaurantId === restaurantId),
  });
}
```

- [ ] **Step 5: Implement `services/search.ts`**

```ts
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Restaurant, MenuItem } from "../types/domain";

export async function searchAll(query: string): Promise<{ restaurants: Restaurant[]; items: MenuItem[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return { restaurants: [], items: [] };

  const restaurants = SEED_RESTAURANTS.filter(
    (r) => r.name.toLowerCase().includes(q) || r.cuisines.some((c) => c.toLowerCase().includes(q))
  );
  const items = SEED_MENU_ITEMS.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));

  return { restaurants, items };
}
```

- [ ] **Step 6: Implement `services/coupons.ts`**

```ts
import { SEED_COUPONS } from "../data/seed/offers";
import { Coupon } from "../types/domain";

export type CouponValidationResult = { ok: true; coupon: Coupon } | { ok: false; reason: string };

export async function validateCoupon(code: string, subtotal: number, restaurantId: string): Promise<CouponValidationResult> {
  const coupon = SEED_COUPONS.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (!coupon) return { ok: false, reason: "Invalid coupon code" };
  if (new Date(coupon.expiresAt).getTime() < Date.now()) return { ok: false, reason: "This coupon has expired" };
  if (coupon.restaurantId && coupon.restaurantId !== restaurantId) return { ok: false, reason: "This coupon isn't valid at this restaurant" };
  if (subtotal < coupon.minOrderAmount) return { ok: false, reason: `Add items worth ₹${coupon.minOrderAmount - subtotal} more to use this coupon` };
  return { ok: true, coupon };
}
```

- [ ] **Step 7: Implement `services/addresses.ts`** (AsyncStorage-backed, seeded on first read)

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Address } from "../types/domain";
import { SEED_ADDRESSES } from "../data/seed/addresses";

const KEY = "crave:addresses";

async function readAll(): Promise<Address[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
  await AsyncStorage.setItem(KEY, JSON.stringify(SEED_ADDRESSES));
  return SEED_ADDRESSES;
}

export async function getAddresses(): Promise<Address[]> {
  return readAll();
}

export async function saveAddress(addr: Address): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((a) => a.id === addr.id);
  let next = index >= 0 ? all.map((a, i) => (i === index ? addr : a)) : [...all, addr];
  if (addr.isDefault) next = next.map((a) => (a.id === addr.id ? a : { ...a, isDefault: false }));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function deleteAddress(id: string): Promise<void> {
  const all = await readAll();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((a) => a.id !== id)));
}
```

- [ ] **Step 8: Implement `services/favorites.ts`** (AsyncStorage-backed sets)

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const REST_KEY = "crave:favorites:restaurants";
const ITEM_KEY = "crave:favorites:items";

async function readIds(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function toggle(key: string, id: string): Promise<boolean> {
  const ids = await readIds(key);
  const isFavorited = ids.includes(id);
  const next = isFavorited ? ids.filter((x) => x !== id) : [...ids, id];
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return !isFavorited;
}

export const getFavoriteRestaurantIds = () => readIds(REST_KEY);
export const getFavoriteMenuItemIds = () => readIds(ITEM_KEY);
export const toggleFavoriteRestaurant = (id: string) => toggle(REST_KEY, id);
export const toggleFavoriteMenuItem = (id: string) => toggle(ITEM_KEY, id);
```

- [ ] **Step 9: Implement `services/orders.ts`** (idempotent order creation via in-memory + AsyncStorage dedupe on `clientRequestId`)

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Order, OrderStatus, CartLineItem, MenuItem, Restaurant, Coupon, Address, PaymentMethod } from "../types/domain";
import { calculateCartTotals } from "../lib/pricing/calculate";
import { SEED_ORDERS } from "../data/seed/orders";

const ORDERS_KEY = "crave:orders";
const REQUEST_IDS_KEY = "crave:order-request-ids";

async function readOrders(): Promise<Order[]> {
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  if (raw) return JSON.parse(raw);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(SEED_ORDERS));
  return SEED_ORDERS;
}

export async function getOrders(): Promise<Order[]> {
  const orders = await readOrders();
  return [...orders].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
}

export async function getOrderById(id: string): Promise<Order | null> {
  const orders = await readOrders();
  return orders.find((o) => o.id === id) ?? null;
}

export interface CreateOrderInput {
  clientRequestId: string;
  restaurant: Restaurant;
  lines: CartLineItem[];
  menuItems: MenuItem[];
  coupon: Coupon | null;
  address: Address;
  paymentMethod: PaymentMethod;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const seenRaw = await AsyncStorage.getItem(REQUEST_IDS_KEY);
  const seen: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
  if (seen[input.clientRequestId]) {
    const existing = await getOrderById(seen[input.clientRequestId]);
    if (existing) return existing; // idempotent replay: return the already-created order, never duplicate
  }

  const totals = calculateCartTotals(input.lines, input.menuItems, input.restaurant, input.coupon);
  const order: Order = {
    id: `ord${Date.now()}`,
    restaurantId: input.restaurant.id,
    restaurantName: input.restaurant.name,
    items: input.lines.map((line) => {
      const item = input.menuItems.find((m) => m.id === line.menuItemId)!;
      return { menuItemId: item.id, name: item.name, quantity: line.quantity, unitPrice: line.unitPrice, customization: line.customization };
    }),
    status: "placed" as OrderStatus,
    placedAt: new Date().toISOString(),
    addressId: input.address.id,
    paymentMethod: input.paymentMethod,
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    tax: totals.tax,
    total: totals.total,
    couponCode: input.coupon?.code,
    etaMinutes: input.restaurant.etaMinutes,
  };

  const orders = await readOrders();
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify([...orders, order]));
  await AsyncStorage.setItem(REQUEST_IDS_KEY, JSON.stringify({ ...seen, [input.clientRequestId]: order.id }));
  return order;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const orders = await readOrders();
  const next = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(next));
}
```

- [ ] **Step 10: Implement `services/auth.ts`** (clearly-labeled mock OTP + guest mode, SecureStore-backed session)

```ts
import * as SecureStore from "expo-secure-store";
import { User } from "../types/domain";

const SESSION_KEY = "crave:session";

export async function getCurrentUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function signInAsGuest(): Promise<User> {
  const user: User = { id: "guest", name: "Guest", isGuest: true };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  return user;
}

// DEV-ONLY MOCK: no real SMS is sent. The OTP is returned directly to the
// caller so the UI can display it labeled "Dev OTP" — this must never ship
// to production without a real SMS provider wired in behind this function.
export async function requestOtp(phone: string): Promise<{ devOtp: string }> {
  return { devOtp: "123456" };
}

export async function verifyOtp(phone: string, code: string): Promise<User> {
  if (code !== "123456") throw new Error("Invalid OTP. Use the dev OTP shown on screen.");
  const user: User = { id: `user-${phone}`, name: "Demo User", phone, isGuest: false };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

- [ ] **Step 11: Run tests to verify they pass**

```bash
npx jest tests/search-filters.test.ts tests/coupons.test.ts
```

Expected: PASS (11/11 tests)

- [ ] **Step 12: Typecheck the whole services layer**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add services features/search tests/search-filters.test.ts tests/coupons.test.ts
git commit -m "feat: add services layer for restaurants, search, coupons, addresses, favorites, orders, auth"
```

---

### Task 6: Zustand Stores (cart, favorites, preferences, auth, notifications)

**Files:**
- Create: `store/cart-store.ts`
- Create: `store/favorites-store.ts`
- Create: `store/preferences-store.ts`
- Create: `store/auth-store.ts`
- Create: `store/notifications-store.ts`
- Test: `tests/cart-store.test.ts`

**Interfaces:**
- Consumes: `CartLineItem`, pricing from Task 4, services from Task 5
- Produces: `useCartStore` with state `{ restaurantId: string | null; lines: CartLineItem[]; couponCode: string | null }` and actions `addItem(menuItem, customization, quantity)`, `removeLine(lineId)`, `updateQuantity(lineId, quantity)`, `clearCart()`, `applyCoupon(code)`, `removeCoupon()`, `replaceCartForNewRestaurant(menuItem, customization, quantity)`. `useFavoritesStore`, `usePreferencesStore` (budget/cuisine/veg-only prefs), `useAuthStore` (`user`, `setUser`, `signOut`), `useNotificationsStore` (in-app notification list + unread count).

- [ ] **Step 1: Write failing test for cart-store cross-restaurant behavior and quantity math**

```ts
// tests/cart-store.test.ts
import { useCartStore } from "../store/cart-store";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";

const paneerBiryani = SEED_MENU_ITEMS.find((i) => i.id === "m1")!;
const otherRestaurantItem = SEED_MENU_ITEMS.find((i) => i.restaurantId !== "r1")!;

beforeEach(() => {
  useCartStore.getState().clearCart();
});

describe("cart-store", () => {
  it("adds an item and sets the cart's restaurant", () => {
    useCartStore.getState().addItem(paneerBiryani, { optionSelections: { og1: "opt1" }, addOnIds: [] }, 1);
    const state = useCartStore.getState();
    expect(state.lines.length).toBe(1);
    expect(state.restaurantId).toBe("r1");
  });

  it("merges identical customizations into one line with increased quantity", () => {
    const customization = { optionSelections: { og1: "opt1" }, addOnIds: [] };
    useCartStore.getState().addItem(paneerBiryani, customization, 1);
    useCartStore.getState().addItem(paneerBiryani, customization, 1);
    const state = useCartStore.getState();
    expect(state.lines.length).toBe(1);
    expect(state.lines[0].quantity).toBe(2);
  });

  it("keeps distinct customizations of the same dish as separate lines", () => {
    useCartStore.getState().addItem(paneerBiryani, { optionSelections: { og1: "opt1" }, addOnIds: [] }, 1);
    useCartStore.getState().addItem(paneerBiryani, { optionSelections: { og1: "opt2" }, addOnIds: [] }, 1);
    expect(useCartStore.getState().lines.length).toBe(2);
  });

  it("flags needsConfirmation and does not mutate cart when adding from a different restaurant", () => {
    useCartStore.getState().addItem(paneerBiryani, { optionSelections: { og1: "opt1" }, addOnIds: [] }, 1);
    const result = useCartStore.getState().addItem(otherRestaurantItem, { optionSelections: {}, addOnIds: [] }, 1);
    expect(result).toEqual({ status: "different-restaurant" });
    expect(useCartStore.getState().lines.length).toBe(1); // unchanged
  });

  it("replaceCartForNewRestaurant clears old lines and starts fresh", () => {
    useCartStore.getState().addItem(paneerBiryani, { optionSelections: { og1: "opt1" }, addOnIds: [] }, 1);
    useCartStore.getState().replaceCartForNewRestaurant(otherRestaurantItem, { optionSelections: {}, addOnIds: [] }, 1);
    const state = useCartStore.getState();
    expect(state.lines.length).toBe(1);
    expect(state.restaurantId).toBe(otherRestaurantItem.restaurantId);
  });

  it("removeLine removes only the targeted line", () => {
    useCartStore.getState().addItem(paneerBiryani, { optionSelections: { og1: "opt1" }, addOnIds: [] }, 1);
    const lineId = useCartStore.getState().lines[0].lineId;
    useCartStore.getState().removeLine(lineId);
    expect(useCartStore.getState().lines.length).toBe(0);
    expect(useCartStore.getState().restaurantId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/cart-store.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `store/cart-store.ts`**

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartCustomization, CartLineItem, MenuItem } from "../types/domain";
import { calculateLineItemPrice } from "../lib/pricing/calculate";

function sameCustomization(a: CartCustomization, b: CartCustomization): boolean {
  return JSON.stringify(a.optionSelections) === JSON.stringify(b.optionSelections) &&
    JSON.stringify([...a.addOnIds].sort()) === JSON.stringify([...b.addOnIds].sort()) &&
    a.spiceLevel === b.spiceLevel &&
    (a.specialInstructions ?? "") === (b.specialInstructions ?? "");
}

type AddItemResult = { status: "ok" } | { status: "different-restaurant" };

interface CartState {
  restaurantId: string | null;
  lines: CartLineItem[];
  couponCode: string | null;
  addItem: (item: MenuItem, customization: CartCustomization, quantity: number) => AddItemResult;
  replaceCartForNewRestaurant: (item: MenuItem, customization: CartCustomization, quantity: number) => void;
  removeLine: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => void;
  removeCoupon: () => void;
}

function buildLine(item: MenuItem, customization: CartCustomization, quantity: number): CartLineItem {
  return {
    lineId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    menuItemId: item.id,
    restaurantId: item.restaurantId,
    quantity,
    customization,
    unitPrice: calculateLineItemPrice(item, customization),
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      lines: [],
      couponCode: null,

      addItem: (item, customization, quantity) => {
        const state = get();
        if (state.restaurantId && state.restaurantId !== item.restaurantId) {
          return { status: "different-restaurant" };
        }

        const existing = state.lines.find((l) => l.menuItemId === item.id && sameCustomization(l.customization, customization));
        if (existing) {
          set({ lines: state.lines.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + quantity } : l)) });
        } else {
          set({ restaurantId: item.restaurantId, lines: [...state.lines, buildLine(item, customization, quantity)] });
        }
        return { status: "ok" };
      },

      replaceCartForNewRestaurant: (item, customization, quantity) => {
        set({ restaurantId: item.restaurantId, lines: [buildLine(item, customization, quantity)], couponCode: null });
      },

      removeLine: (lineId) => {
        const remaining = get().lines.filter((l) => l.lineId !== lineId);
        set({ lines: remaining, restaurantId: remaining.length ? get().restaurantId : null, couponCode: remaining.length ? get().couponCode : null });
      },

      updateQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeLine(lineId);
          return;
        }
        set({ lines: get().lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)) });
      },

      clearCart: () => set({ restaurantId: null, lines: [], couponCode: null }),
      applyCoupon: (code) => set({ couponCode: code }),
      removeCoupon: () => set({ couponCode: null }),
    }),
    { name: "crave:cart", storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/cart-store.test.ts
```

Expected: PASS (6/6 tests)

- [ ] **Step 5: Implement `store/favorites-store.ts`**

```ts
import { create } from "zustand";
import { getFavoriteRestaurantIds, getFavoriteMenuItemIds, toggleFavoriteRestaurant, toggleFavoriteMenuItem } from "../services/favorites";

interface FavoritesState {
  restaurantIds: string[];
  menuItemIds: string[];
  loaded: boolean;
  load: () => Promise<void>;
  toggleRestaurant: (id: string) => Promise<void>;
  toggleMenuItem: (id: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  restaurantIds: [],
  menuItemIds: [],
  loaded: false,
  load: async () => {
    const [restaurantIds, menuItemIds] = await Promise.all([getFavoriteRestaurantIds(), getFavoriteMenuItemIds()]);
    set({ restaurantIds, menuItemIds, loaded: true });
  },
  toggleRestaurant: async (id) => {
    await toggleFavoriteRestaurant(id);
    const restaurantIds = get().restaurantIds.includes(id) ? get().restaurantIds.filter((x) => x !== id) : [...get().restaurantIds, id];
    set({ restaurantIds });
  },
  toggleMenuItem: async (id) => {
    await toggleFavoriteMenuItem(id);
    const menuItemIds = get().menuItemIds.includes(id) ? get().menuItemIds.filter((x) => x !== id) : [...get().menuItemIds, id];
    set({ menuItemIds });
  },
}));
```

- [ ] **Step 6: Implement `store/preferences-store.ts`**

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Preferences {
  vegOnly: boolean;
  favoriteCuisines: string[];
  budgetPerMeal: number | null; // INR, null = no preference
}

interface PreferencesState {
  preferences: Preferences;
  setPreferences: (next: Partial<Preferences>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: { vegOnly: false, favoriteCuisines: [], budgetPerMeal: null },
      setPreferences: (next) => set({ preferences: { ...get().preferences, ...next } }),
    }),
    { name: "crave:preferences", storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 7: Implement `store/auth-store.ts`**

```ts
import { create } from "zustand";
import { User } from "../types/domain";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  setHydrated: () => set({ hydrated: true }),
}));
```

- [ ] **Step 8: Implement `store/notifications-store.ts`** (in-app notifications — explicitly NOT push; Task 20 wires real notification creation)

```ts
import { create } from "zustand";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  push: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  push: (notification) => {
    const item: AppNotification = { ...notification, id: `n${Date.now()}`, createdAt: new Date().toISOString(), read: false };
    set({ items: [item, ...get().items], unreadCount: get().unreadCount + 1 });
  },
  markAllRead: () => set({ items: get().items.map((i) => ({ ...i, read: true })), unreadCount: 0 }),
}));
```

- [ ] **Step 9: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add store tests/cart-store.test.ts
git commit -m "feat: add Zustand stores for cart, favorites, preferences, auth, and notifications"
```

---

### Task 7: UI Primitives

**Files:**
- Create: `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Badge.tsx`, `components/ui/TextField.tsx`, `components/ui/Skeleton.tsx`, `components/ui/EmptyState.tsx`, `components/ui/RatingPill.tsx`, `components/ui/QuantityStepper.tsx`, `components/ui/SectionHeader.tsx`

**Interfaces:**
- Produces: `<Button variant="primary"|"secondary"|"outline" size="md"|"lg" loading? disabled? onPress title />`, `<Card>`, `<Badge label tone="primary"|"success"|"muted" />`, `<TextField label error? ...TextInputProps />`, `<Skeleton width height radius? />`, `<EmptyState icon title description action? />`, `<RatingPill rating reviewCount? />`, `<QuantityStepper quantity onIncrement onDecrement min? />`, `<SectionHeader title actionLabel? onActionPress? />` — every later screen task imports these instead of styling raw `View`/`Text`.

- [ ] **Step 1: Implement `components/ui/Button.tsx`**

```tsx
import React from "react";
import { Pressable, Text, ActivityIndicator, PressableProps } from "react-native";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "md" | "lg";
  loading?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary active:bg-primary-deep",
  secondary: "bg-ink active:bg-black",
  outline: "bg-transparent border border-border active:bg-border",
};

const TEXT_CLASSES: Record<string, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-ink",
};

export function Button({ title, variant = "primary", size = "md", loading, disabled, ...props }: ButtonProps) {
  const padding = size === "lg" ? "py-4" : "py-3";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      className={`rounded-2xl ${padding} px-5 items-center justify-center ${VARIANT_CLASSES[variant]} ${disabled ? "opacity-50" : ""}`}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === "outline" ? "#202020" : "#fff"} /> : <Text className={`font-semibold text-base ${TEXT_CLASSES[variant]}`}>{title}</Text>}
    </Pressable>
  );
}
```

- [ ] **Step 2: Implement `components/ui/Card.tsx`**

```tsx
import React from "react";
import { View, ViewProps } from "react-native";

export function Card({ children, className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`bg-card rounded-2xl border border-border shadow-sm ${className}`} {...props}>
      {children}
    </View>
  );
}
```

- [ ] **Step 3: Implement `components/ui/Badge.tsx`**

```tsx
import React from "react";
import { View, Text } from "react-native";

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  muted: "bg-border text-muted",
};

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "muted" }) {
  const [bg, text] = TONE_CLASSES[tone].split(" ");
  return (
    <View className={`${bg} rounded-full px-2.5 py-1 self-start`}>
      <Text className={`text-xs font-semibold ${text}`}>{label}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Implement `components/ui/TextField.tsx`**

```tsx
import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...props }: TextFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-ink mb-1.5">{label}</Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base text-ink bg-card ${error ? "border-red-400" : "border-border"}`}
        placeholderTextColor="#777777"
        {...props}
      />
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 5: Implement `components/ui/Skeleton.tsx`**

```tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";

export function Skeleton({ width, height, radius = 8 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: "#F0E7E0" }, style]} />;
}
```

- [ ] **Step 6: Implement `components/ui/EmptyState.tsx`**

```tsx
import React from "react";
import { View, Text } from "react-native";
import { Button } from "./Button";
import { LucideIcon } from "lucide-react-native";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View className="bg-border/60 rounded-full p-5 mb-4">
        <Icon size={32} color="#777777" />
      </View>
      <Text className="text-lg font-semibold text-ink text-center mb-1">{title}</Text>
      {description ? <Text className="text-sm text-muted text-center mb-5">{description}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}
```

- [ ] **Step 7: Implement `components/ui/RatingPill.tsx`**

```tsx
import React from "react";
import { View, Text } from "react-native";
import { Star } from "lucide-react-native";

export function RatingPill({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  return (
    <View className="flex-row items-center bg-success/10 rounded-full px-2 py-0.5 self-start">
      <Star size={12} color="#198754" fill="#198754" />
      <Text className="text-xs font-semibold text-success ml-1">{rating.toFixed(1)}</Text>
      {reviewCount ? <Text className="text-xs text-success ml-1">({reviewCount})</Text> : null}
    </View>
  );
}
```

- [ ] **Step 8: Implement `components/ui/QuantityStepper.tsx`**

```tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Minus } from "lucide-react-native";

export function QuantityStepper({ quantity, onIncrement, onDecrement, min = 0 }: { quantity: number; onIncrement: () => void; onDecrement: () => void; min?: number }) {
  return (
    <View className="flex-row items-center bg-primary rounded-full">
      <Pressable accessibilityLabel="Decrease quantity" onPress={onDecrement} disabled={quantity <= min} className="p-2.5">
        <Minus size={16} color="#fff" />
      </Pressable>
      <Text className="text-white font-semibold w-6 text-center">{quantity}</Text>
      <Pressable accessibilityLabel="Increase quantity" onPress={onIncrement} className="p-2.5">
        <Plus size={16} color="#fff" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 9: Implement `components/ui/SectionHeader.tsx`**

```tsx
import React from "react";
import { View, Text, Pressable } from "react-native";

export function SectionHeader({ title, actionLabel, onActionPress }: { title: string; actionLabel?: string; onActionPress?: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-4 mb-3 mt-5">
      <Text className="text-lg font-bold text-ink">{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress}>
          <Text className="text-sm font-semibold text-primary">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 10: Typecheck and lint-boot**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add components/ui
git commit -m "feat: add UI primitive components (Button, Card, Badge, TextField, Skeleton, EmptyState, RatingPill, QuantityStepper, SectionHeader)"
```

---

### Task 8: Navigation Shell (root layout, tabs layout, splash redirect)

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/index.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/auth/_layout.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 6), design tokens (Task 1)
- Produces: route structure that every subsequent screen task plugs into. `app/index.tsx` is the splash; it redirects to `/onboarding` (first launch), `/auth/login` (not authenticated, not guest), or `/(tabs)/home` (authenticated or guest) once hydration completes.

- [ ] **Step 1: Implement `app/_layout.tsx`**

```tsx
import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/auth-store";
import { getCurrentUser } from "../services/auth";

const queryClient = new QueryClient();

export default function RootLayout() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setUser(user);
      setHydrated();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding/index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="restaurant/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="food/[id]" options={{ presentation: "modal" }} />
            <Stack.Screen name="cart/index" options={{ presentation: "card" }} />
            <Stack.Screen name="checkout/index" options={{ presentation: "card" }} />
            <Stack.Screen name="checkout/payment" options={{ presentation: "card" }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Implement `app/index.tsx`** (splash + redirect logic)

```tsx
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/auth-store";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants/brand";

export default function Splash() {
  const { user, hydrated } = useAuthStore();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("crave:onboarding-seen").then((v) => setOnboardingSeen(v === "true"));
  }, []);

  if (!hydrated || onboardingSeen === null) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Text className="text-white text-3xl font-extrabold tracking-wide">{BRAND_NAME}</Text>
        <Text className="text-white/80 mt-1">{BRAND_TAGLINE}</Text>
      </View>
    );
  }

  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/auth/login" />;
  return <Redirect href="/(tabs)/home" />;
}
```

- [ ] **Step 3: Implement `app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { Home, Compass, ReceiptText, Heart, User } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF5A36",
        tabBarInactiveTintColor: "#777777",
        tabBarStyle: { borderTopColor: "#F0E7E0" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites", tabBarIcon: ({ color, size }) => <Heart color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Implement `app/auth/_layout.tsx`** (stack, no tab bar — keeps auth flow out of the bottom nav per Global Constraints)

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="location-select" />
    </Stack>
  );
}
```

- [ ] **Step 5: Add placeholder leaf screens so the router doesn't crash on missing routes**

Create minimal placeholder files for every leaf screen listed in the File Structure that later tasks will flesh out (`app/onboarding/index.tsx` through `app/profile/help.tsx`) — each just a `<View><Text>` with the route name, so routing can be smoke-tested now and overwritten task-by-task without ever leaving a broken route.

```tsx
// Example pattern, repeat for every remaining route file in the structure:
import { View, Text } from "react-native";
export default function Placeholder() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="text-ink">TODO: implement this screen</Text>
    </View>
  );
}
```

- [ ] **Step 6: Smoke-test navigation**

```bash
npx expo start --clear
```

Expected: app boots to the CRAVE splash, then redirects to the onboarding placeholder with no red-box routing errors. Manually confirm Android back button from a pushed route returns to the previous screen (use `w` for web preview or a connected emulator).

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "feat: add navigation shell with splash redirect, tabs layout, and auth stack"
```

---

### Task 9: Splash Animation, Onboarding, Auth (Login/OTP/Guest), Location Select

**Files:**
- Modify: `app/index.tsx` (add Reanimated fade/scale-in on the logo)
- Create: `app/onboarding/index.tsx`
- Create: `app/auth/login.tsx`
- Create: `app/auth/otp.tsx`
- Create: `app/auth/location-select.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, `services/auth.ts` (Task 5/6), `Button`/`TextField` (Task 7)
- Produces: completed onboarding sets `AsyncStorage["crave:onboarding-seen"] = "true"`; successful login/guest sign-in calls `useAuthStore().setUser(user)` then `router.replace("/(tabs)/home")`.

- [ ] **Step 1: Add fade/scale animation to the splash logo**

In `app/index.tsx`, wrap the brand `Text` block in an `Animated.View` using Reanimated's `useSharedValue`/`withTiming` to animate `opacity` 0→1 and `scale` 0.9→1 over 500ms on mount, matching the existing conditional-redirect logic already in the file.

- [ ] **Step 2: Implement `app/onboarding/index.tsx`** — 4-slide horizontal `FlatList` (Discover food / Find nearby restaurants / Track deliveries / Personalized recommendations) with pagination dots, a "Skip" button always visible, and "Get Started" on the last slide. On skip or finish: `await AsyncStorage.setItem("crave:onboarding-seen", "true")` then `router.replace("/auth/login")`.

- [ ] **Step 3: Implement `app/auth/login.tsx`** — phone number input (`TextField`, numeric keyboard, 10-digit Zod validation), "Send OTP" button calling `requestOtp(phone)` and navigating to `/auth/otp?phone=...&devOtp=...`, and a "Continue as Guest" link calling `signInAsGuest()` then `setUser(...)` then `router.replace("/(tabs)/home")`. Clearly render "Dev mode: OTP will be shown on screen" caption.

- [ ] **Step 4: Implement `app/auth/otp.tsx`** — reads `phone`/`devOtp` params, 6-digit OTP input, displays `Dev OTP: {devOtp}` in a muted `Badge`, "Verify" button calls `verifyOtp(phone, code)`, on success `setUser(user)` + `router.replace("/auth/location-select")`; on failure shows inline error from the thrown message without crashing.

- [ ] **Step 5: Implement `app/auth/location-select.tsx`** — requests `expo-location` foreground permission via `Location.requestForegroundPermissionsAsync()`; on grant, reverse-geocodes to a human-readable area string and saves it as the active location; on deny or error, shows a manual text entry field (and a "Skip for now" button) so the flow never blocks — then `router.replace("/(tabs)/home")`.

- [ ] **Step 6: Manual smoke test**

```bash
npx expo start --clear
```

Expected: fresh install walks splash → onboarding (skip works) → login → OTP (dev code visible and accepted) → location select (both grant and deny paths navigable) → home tab. Relaunch after reaching home: splash redirects straight to `(tabs)/home`, skipping onboarding/login (confirms persistence).

- [ ] **Step 7: Commit**

```bash
git add app/index.tsx app/onboarding app/auth
git commit -m "feat: add splash animation, onboarding, mock OTP auth, and location selection"
```

---

### Task 10: Home Screen

**Files:**
- Create: `components/home/CategoryCard.tsx`
- Create: `components/home/RestaurantCard.tsx`
- Create: `components/home/FoodCard.tsx`
- Create: `components/home/HorizontalCarousel.tsx`
- Create: `app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `getRestaurants()` (Task 5) via `useQuery`, `useFavoritesStore`, `useCartStore`, `SEED_MENU_ITEMS`/`SEED_CATEGORIES` for category chips
- Produces: tapping a `RestaurantCard` → `router.push("/restaurant/[id]")`; tapping a `FoodCard`'s add button adds directly to cart (simple items) or opens `/food/[id]` (items with required option groups); the favorite icon on `RestaurantCard` calls `useFavoritesStore().toggleRestaurant(id)`.

- [ ] **Step 1: Implement `components/home/RestaurantCard.tsx`** — `Card` with `Image` cover (fixed aspect ratio via `aspectRatio: 16/9`), name, cuisines joined by " · ", `RatingPill`, ETA + delivery fee row, optional `Badge` for the first tag/offer, and a heart icon button (filled when favorited) in the top-right corner over the image.

- [ ] **Step 2: Implement `components/home/FoodCard.tsx`** — image, veg/non-veg indicator dot (green square outline for veg, brown/red triangle outline for non-veg per Indian FSSAI convention — implement as a small colored square/triangle icon, not emoji), name, `formatCurrency(basePrice)`, rating if present, and an "Add" button that either calls `useCartStore().addItem` directly (no required option groups) or navigates to `/food/[id]`.

- [ ] **Step 3: Implement `components/home/CategoryCard.tsx`** — small rounded image/icon tile + label, `onPress` navigates to `/search?cuisine=<name>`.

- [ ] **Step 4: Implement `components/home/HorizontalCarousel.tsx`** — thin wrapper around `FlatList` with `horizontal`, `showsHorizontalScrollIndicator={false}`, `ItemSeparatorComponent` spacing, generic over item type via props (`data`, `renderItem`, `keyExtractor`).

- [ ] **Step 5: Implement `app/(tabs)/home.tsx`**

Structure: header (location + greeting + notification bell linking to `/notifications`, profile avatar linking to `/(tabs)/profile`), search bar (`Pressable` navigating to `/search`, not an inline input, to match "Search biryani, pizza, restaurants..." placeholder pattern), a `HorizontalCarousel` of hardcoded-from-seed cuisine categories, then `SectionHeader` + `HorizontalCarousel` sections for: "Special Offers" (from `SEED_OFFERS`), "Popular Near You" (restaurants sorted by `ratingCount`), "Trending Dishes" (`SEED_MENU_ITEMS.filter(i => i.popular)`), "Top Rated" (`filterRestaurants(..., {sortBy: "rating"})`), "Budget Friendly" (`priceRange === 1`), "Quick Delivery" (`etaMinutes <= 30`). Use `useQuery(["restaurants"], getRestaurants)` for the restaurant list; render `Skeleton` placeholders while loading and an `EmptyState` if the query errors (with a retry button calling `refetch()`). "Previously Ordered" and "Favorite Restaurants" sections render only when `getOrders()`/`useFavoritesStore` have data (conditionally omitted, not shown empty, per spec's personalization honesty requirement) — "Recommended for You" always renders using the simple recommendation logic from Task 17 once that exists; until then, home.tsx may call a small local `getPopularFallback(restaurants)` helper inline. Wrap the whole screen in a `FlatList` with the sections as `ListHeaderComponent` content (not nested `ScrollView`s) to avoid the nested-scroll performance pitfall from Global Constraints.

- [ ] **Step 6: Manual smoke test**

```bash
npx expo start --clear
```

Expected: Home renders all sections with real seed images/text, tapping any restaurant card navigates to the (still-placeholder) restaurant details route, adding a simple food item updates a visible cart-count badge (wire a minimal badge now if checkout nav doesn't exist yet — reuse in Task 11+).

- [ ] **Step 7: Commit**

```bash
git add components/home app/\(tabs\)/home.tsx
git commit -m "feat: implement Home screen with categories, carousels, and functional add-to-cart"
```

---

### Task 11: Explore / Search / Filters

**Files:**
- Create: `app/(tabs)/explore.tsx`
- Create: `app/search/index.tsx`

**Interfaces:**
- Consumes: `searchAll()`, `filterRestaurants()` (Task 5), `usePreferencesStore`
- Produces: `/search?cuisine=X` pre-applies a cuisine filter; recent searches persisted to AsyncStorage key `crave:recent-searches` (max 8, de-duplicated, most-recent-first).

- [ ] **Step 1: Implement `app/(tabs)/explore.tsx`** — a browsing surface distinct from search: grid of all cuisines (reuse `CategoryCard`), "Popular Dishes" carousel, and a filter bar (veg-only toggle, sort chips: Relevance/Rating/Price/Delivery Time) applied to a `FlatList` of all restaurants via `filterRestaurants`. Each filter chip is a `Pressable` `Badge`-styled toggle; "Clear Filters" resets to `{}`. Tapping the search bar at the top navigates to `/search`.

- [ ] **Step 2: Implement `app/search/index.tsx`** — controlled `TextInput` with 300ms debounce (via `useRef` timeout, not an external debounce lib) calling `searchAll(query)` through `useQuery` keyed on the debounced value; while `query === ""`, show "Recent Searches" (tappable chips, each with an 'x' to remove) and "Suggested Searches" (static curated list: "Biryani", "Pizza near me", "Vegetarian under ₹200", "Highly rated"); on submit/debounced-result, render two sections — matching restaurants (`RestaurantCard`) and matching dishes (`FoodCard`) — or an `EmptyState` ("No results for '{query}'") when both are empty. On any executed search, push the query into recent searches.

- [ ] **Step 3: Manual smoke test**

```bash
npx expo start --clear
```

Expected: typing "biryani" returns both Biryani Junction and Paneer Biryani; typing gibberish shows the empty state; filters on Explore narrow the restaurant list correctly and "Clear Filters" restores the full list; recent searches persist across an app reload.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/explore.tsx app/search
git commit -m "feat: implement Explore browsing and debounced Search with filters and recent searches"
```

---

### Task 12: Restaurant Details

**Files:**
- Create: `components/restaurant/MenuCategoryBar.tsx`
- Create: `components/restaurant/MenuItemRow.tsx`
- Create: `app/restaurant/[id].tsx`

**Interfaces:**
- Consumes: `getRestaurantById`, `getMenuForRestaurant` (Task 5)
- Produces: tapping a `MenuItemRow`'s add button either adds directly (no required groups) or navigates to `/food/[id]`; `isOpen: false` restaurants render a persistent banner and disable every add action.

- [ ] **Step 1: Implement `components/restaurant/MenuCategoryBar.tsx`** — horizontal sticky chip row (one chip per `MenuCategory`, active chip highlighted) that scrolls the menu list to that category's first item on tap (track via `onLayout` offsets + `FlatList.scrollToOffset`, or a `SectionList` keyed by category — prefer `SectionList` with `MenuCategoryBar` driving `scrollToLocation`).

- [ ] **Step 2: Implement `components/restaurant/MenuItemRow.tsx`** — name, veg/non-veg indicator, short description (truncated 2 lines), price, rating if present, thumbnail image, and an "Add" control — a `QuantityStepper` once added, otherwise a bordered "ADD" button; disabled + "Currently unavailable" label when `!isAvailable`; disabled entirely (no button shown, just "Unavailable" text) when the parent restaurant `!isOpen`.

- [ ] **Step 3: Implement `app/restaurant/[id].tsx`** — hero cover image, name/cuisines/rating/ETA/delivery fee row, `isOpen: false` banner ("Closed now · Opens at {operatingHours.opensAt}") when applicable, offers list from `SEED_OFFERS` filtered by `restaurantId`, a search-within-menu `TextInput` filtering the already-fetched menu items client-side, `MenuCategoryBar`, then a `SectionList` of `MenuItemRow`s grouped by category (Popular items pinned as a synthetic first section when any `popular: true` items exist for this restaurant). Use `useQuery(["restaurant", id], ...)` and `useQuery(["menu", id], ...)` in parallel; render full-screen `Skeleton` layout while either loads, `EmptyState` with retry on error.

- [ ] **Step 4: Manual smoke test**

```bash
npx expo start --clear
```

Expected: open a restaurant with `isOpen:false` seed data and confirm the banner shows and no item can be added; open an open restaurant, confirm category bar scrolling and in-menu search both work; add a simple item directly from the row and confirm the cart badge increments.

- [ ] **Step 5: Commit**

```bash
git add components/restaurant app/restaurant
git commit -m "feat: implement restaurant details screen with menu browsing, category nav, and closed-state handling"
```

---

### Task 13: Food Item Customization

**Files:**
- Create: `components/food/CustomizationSheet.tsx`
- Create: `app/food/[id].tsx`

**Interfaces:**
- Consumes: `MenuItem`, `calculateLineItemPrice` (Task 4), `useCartStore().addItem`/`replaceCartForNewRestaurant`
- Produces: a confirmation dialog when `addItem` returns `{ status: "different-restaurant" }`, offering "Start New Cart" (calls `replaceCartForNewRestaurant`) or "Cancel" — this is the one and only place that cross-restaurant-cart conflict is resolved, per Global Constraints and spec §10.

- [ ] **Step 1: Implement `components/food/CustomizationSheet.tsx`** as the shared body (used by `app/food/[id].tsx` as a full screen, since Expo Router's modal presentation already gives the sheet-like feel): image, name, description, dietary `Badge`, then for each `optionGroups` entry a radio-button group (required groups show a "Required" `Badge`; selecting is mandatory before "Add to Cart" enables), for `addOns` a checkbox list, for `supportsSpiceLevel` a 3-way segmented control (Mild/Medium/Spicy), a multiline `TextField` for special instructions (optional, 140 char max), a `QuantityStepper` (min 1), and a sticky bottom bar showing live `formatCurrency(calculateLineItemPrice(item, customization) * quantity)` and an "Add to Cart" `Button` disabled until every required option group has a selection.

- [ ] **Step 2: Implement `app/food/[id].tsx`** — resolves the `MenuItem` by id from `getMenuForRestaurant` lookup (or add a `getMenuItemById` helper to `services/restaurants.ts` if a direct lookup is cleaner — prefer adding `getMenuItemById(id): Promise<MenuItem | null>` there for a single round trip), renders `CustomizationSheet`, and on "Add to Cart": call `useCartStore().addItem(item, customization, quantity)`; if the result is `{status: "different-restaurant"}`, show a confirm dialog (`Alert.alert` is acceptable here since it's a one-off blocking confirmation, not a styled UI surface) and on confirm call `replaceCartForNewRestaurant(...)` then `router.back()`; on `{status: "ok"}` show a brief success toast/snackbar substitute (a `Reanimated`-faded `Text` banner is fine — no extra dependency) and `router.back()`.

- [ ] **Step 3: Add `getMenuItemById` to `services/restaurants.ts`**

```ts
export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  return delay(SEED_MENU_ITEMS.find((m) => m.id === id) ?? null);
}
```

(Add the corresponding import of `SEED_MENU_ITEMS` at the top of the file alongside the existing seed imports.)

- [ ] **Step 4: Manual smoke test**

```bash
npx expo start --clear
```

Expected: open Paneer Biryani (m1), confirm price updates live when switching Size/add-ons/spice; confirm "Add to Cart" is disabled until Size (required) is picked; add it, then open an item from a different restaurant and confirm the cross-restaurant confirmation dialog appears and correctly replaces the cart on confirm.

- [ ] **Step 5: Commit**

```bash
git add components/food app/food services/restaurants.ts
git commit -m "feat: implement food item customization screen with live pricing and cross-restaurant cart guard"
```

---

### Task 14: Cart Screen

**Files:**
- Create: `components/cart/CartLineItem.tsx`
- Create: `components/cart/CouponRow.tsx`
- Create: `components/cart/PriceBreakdown.tsx`
- Create: `app/cart/index.tsx`

**Interfaces:**
- Consumes: `useCartStore`, `calculateCartTotals` (Task 4), `validateCoupon` (Task 5)
- Produces: `app/checkout/index.tsx` (Task 15) reads `useCartStore` + the same `calculateCartTotals` call directly — no duplicated pricing state is passed via route params.

- [ ] **Step 1: Implement `components/cart/CartLineItem.tsx`** — item name, resolved customization summary line (e.g. "Large · Extra Paneer, Raita · Medium spice"), `QuantityStepper` wired to `updateQuantity`/`removeLine` (decrementing to 0 removes the line), unit-line subtotal via `formatCurrency`, and an "Edit" link that navigates to `/food/[menuItemId]?lineId=...` (edit support: Task 13's screen may ignore `lineId` for this sub-project if editing-in-place is deferred — but the link must at least let the user remove-and-re-add, so wire "Edit" to simply `router.push("/food/[id]")` for now and document this as the editing entry point).

- [ ] **Step 2: Implement `components/cart/CouponRow.tsx`** — applied-state (code + description + a "Remove" link) vs. unapplied-state (`TextField` + "Apply" button calling `validateCoupon`, showing the `reason` string inline on failure).

- [ ] **Step 3: Implement `components/cart/PriceBreakdown.tsx`** — renders `CartTotals` as labeled rows (Item Subtotal, Discount, Delivery Fee, Taxes, Total) using `formatCurrency`, strikethrough-styling the delivery fee row when `freeDelivery` is true.

- [ ] **Step 4: Implement `app/cart/index.tsx`** — empty state (`EmptyState` with "Browse Restaurants" action → `/(tabs)/home`) when `lines.length === 0`; otherwise restaurant name header, `FlatList` of `CartLineItem`s, min-order warning banner when `subtotal < restaurant.minOrderAmount` (disables checkout button and states the shortfall amount), `CouponRow`, `PriceBreakdown`, and a sticky "Proceed to Checkout" `Button` navigating to `/checkout`. Resolve `restaurant` via `useQuery(["restaurant", cartStore.restaurantId])`.

- [ ] **Step 5: Manual smoke test**

```bash
npx expo start --clear
```

Expected: cart reflects items added in Tasks 10/13 with correct totals; applying `BIRYANI20` at Biryani Junction with a ≥₹299 subtotal reduces the total correctly; applying it below the minimum shows the correct shortfall message; emptying the cart shows the empty state.

- [ ] **Step 6: Commit**

```bash
git add components/cart app/cart
git commit -m "feat: implement cart screen with coupon application and price breakdown"
```

---

### Task 15: Address Management, Checkout, Mock Payment

**Files:**
- Create: `app/addresses/index.tsx`
- Create: `app/addresses/edit.tsx`
- Create: `app/checkout/index.tsx`
- Create: `app/checkout/payment.tsx`
- Create: `lib/validation/schemas.ts`

**Interfaces:**
- Consumes: `getAddresses`/`saveAddress`/`deleteAddress` (Task 5), `validateCoupon`, `createOrder` (Task 5), `useCartStore`
- Produces: `addressSchema` (Zod) used by both the address form and checkout's "add new address" inline flow; `createOrder` is called exactly once per checkout attempt via a stable `clientRequestId` generated once per checkout session (stored in component state, regenerated only when the user backs out and restarts checkout) — this is the idempotency mechanism required by Global Constraints.

- [ ] **Step 1: Implement `lib/validation/schemas.ts`**

```ts
import { z } from "zod";

export const addressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]),
  recipientName: z.string().min(2, "Enter a name"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  line1: z.string().min(3, "Enter house/building"),
  area: z.string().min(2, "Enter area"),
  city: z.string().min(2, "Enter city"),
  state: z.string().min(2, "Enter state"),
  postalCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  landmark: z.string().optional(),
  instructions: z.string().max(140).optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;
```

- [ ] **Step 2: Implement `app/addresses/index.tsx`** — `FlatList` of saved addresses (via `useQuery(["addresses"], getAddresses)`) rendered as `Card`s with label `Badge`, full address text, "Set as Default" / "Edit" / "Delete" actions (delete behind a confirm `Alert.alert`), and an "Add New Address" button → `/addresses/edit`. Supports an optional `?selectMode=true` param: when present, tapping a `Card` instead calls a passed-back selection (use a lightweight global via `useCartStore`-adjacent approach is overkill — instead store the "selected address id" in a small new `store/checkout-selection-store.ts` Zustand store with just `{ selectedAddressId: string | null; setSelectedAddressId }`, read by `app/checkout/index.tsx`) and navigates back.

- [ ] **Step 3: Create `store/checkout-selection-store.ts`**

```ts
import { create } from "zustand";

interface CheckoutSelectionState {
  selectedAddressId: string | null;
  paymentMethod: "upi" | "card" | "netbanking" | "cod";
  setSelectedAddressId: (id: string) => void;
  setPaymentMethod: (method: CheckoutSelectionState["paymentMethod"]) => void;
}

export const useCheckoutSelectionStore = create<CheckoutSelectionState>((set) => ({
  selectedAddressId: null,
  paymentMethod: "upi",
  setSelectedAddressId: (id) => set({ selectedAddressId: id }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
}));
```

- [ ] **Step 4: Implement `app/addresses/edit.tsx`** — `useForm` with `zodResolver(addressSchema)`, `TextField` per field, label picker as 3 `Pressable` chips (Home/Work/Other), "Save Address" calling `saveAddress` with a generated id (`addr${Date.now()}`) when creating, then `router.back()`.

- [ ] **Step 5: Implement `app/checkout/index.tsx`** — delivery address card (shows `useCheckoutSelectionStore().selectedAddressId` resolved address, defaulting to the user's default address on first mount via an effect, "Change" → `/addresses?selectMode=true`), contact info (from the resolved address), delivery instructions (editable `TextField`, optional), order summary (restaurant + line items, reused `CartLineItem` in a read-only compact mode or a simpler inline list), `PriceBreakdown` (recomputed from `useCartStore` + resolved restaurant + applied coupon — never trust a value passed through navigation params), payment method selector (`upi`/`card`/`netbanking`/`cod` as selectable cards, each labeled "Dev simulation" where relevant), and a "Place Order" `Button`. On mount, generate and store a `clientRequestId` in a `useState(() => uuidLike())` so it's stable for the screen's lifetime but fresh if the user leaves and comes back later. "Place Order" navigates to `/checkout/payment` passing nothing but relying on the shared stores (cart, selection, clientRequestId held in route param since payment.tsx is a separate screen — pass it as a query param string).

- [ ] **Step 6: Implement `app/checkout/payment.tsx`** — clearly labeled "Dev Payment Simulation" banner; renders the selected method with a simulated processing state (`ActivityIndicator` for ~1.5s via `setTimeout`), then calls `createOrder({ clientRequestId, restaurant, lines, menuItems, coupon, address, paymentMethod })`; on success, call `useCartStore().clearCart()` and `router.replace("/order-confirmation/[orderId]")`; on thrown error, show a retry `Button` that re-invokes the same call with the same `clientRequestId` (proving idempotency — a retry after a simulated failure must not double-charge/double-order). COD skips the "processing" animation and creates the order immediately with `paymentMethod: "cod"`.

- [ ] **Step 7: Manual smoke test**

```bash
npx expo start --clear
```

Expected: full checkout path from a populated cart creates exactly one order (verify via `/( tabs)/orders` shows only one new entry even if you tap "Place Order" twice quickly or retry after simulated failure); address CRUD works and persists.

- [ ] **Step 8: Commit**

```bash
git add app/addresses app/checkout lib/validation store/checkout-selection-store.ts
git commit -m "feat: implement address management, checkout flow, and idempotent mock payment"
```

---

### Task 16: Order Confirmation, Tracking Simulation, Orders List, Reorder

**Files:**
- Create: `components/orders/OrderCard.tsx`
- Create: `components/orders/TrackingTimeline.tsx`
- Create: `app/order-confirmation/[orderId].tsx`
- Create: `app/tracking/[orderId].tsx`
- Create: `app/order-details/[orderId].tsx`
- Create: `app/(tabs)/orders.tsx`
- Create: `features/orders/reorder.ts`
- Test: `tests/reorder.test.ts`

**Interfaces:**
- Consumes: `getOrders`, `getOrderById`, `updateOrderStatus` (Task 5), `getMenuForRestaurant`, `getRestaurantById`
- Produces: `buildReorderCart(order: Order, restaurant: Restaurant | null, currentMenuItems: MenuItem[]): ReorderResult` where `ReorderResult = { addableLines: CartLineItem[]; unavailableItems: { name: string; reason: string }[]; restaurantUnavailable: boolean }` — pure function, no side effects, so it's independently testable before wiring into the UI.

- [ ] **Step 1: Write failing test for reorder validation**

```ts
// tests/reorder.test.ts
import { buildReorderCart } from "../features/orders/reorder";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Order } from "../types/domain";

const restaurant = SEED_RESTAURANTS.find((r) => r.id === "r1")!;
const currentMenu = SEED_MENU_ITEMS.filter((i) => i.restaurantId === "r1");

const sampleOrder: Order = {
  id: "ord1", restaurantId: "r1", restaurantName: restaurant.name,
  items: [{ menuItemId: "m1", name: "Paneer Biryani", quantity: 1, unitPrice: 220, customization: { optionSelections: { og1: "opt1" }, addOnIds: [] } }],
  status: "delivered", placedAt: "2026-09-01T00:00:00.000Z", addressId: "addr1", paymentMethod: "upi",
  subtotal: 220, discount: 0, deliveryFee: 29, tax: 11, total: 260,
};

describe("buildReorderCart", () => {
  it("rebuilds a line for each still-available item at current price", () => {
    const result = buildReorderCart(sampleOrder, restaurant, currentMenu);
    expect(result.restaurantUnavailable).toBe(false);
    expect(result.addableLines.length).toBe(1);
    expect(result.addableLines[0].unitPrice).toBe(220); // current base price, not a stale number
    expect(result.unavailableItems.length).toBe(0);
  });

  it("flags items that no longer exist on the menu", () => {
    const vanishedOrder: Order = { ...sampleOrder, items: [{ ...sampleOrder.items[0], menuItemId: "does-not-exist" }] };
    const result = buildReorderCart(vanishedOrder, restaurant, currentMenu);
    expect(result.addableLines.length).toBe(0);
    expect(result.unavailableItems.length).toBe(1);
    expect(result.unavailableItems[0].reason).toMatch(/no longer available/i);
  });

  it("flags items that are currently marked unavailable", () => {
    const menuWithUnavailable = currentMenu.map((i) => (i.id === "m1" ? { ...i, isAvailable: false } : i));
    const result = buildReorderCart(sampleOrder, restaurant, menuWithUnavailable);
    expect(result.unavailableItems.length).toBe(1);
  });

  it("flags restaurantUnavailable when the restaurant is null or closed", () => {
    const result = buildReorderCart(sampleOrder, null, currentMenu);
    expect(result.restaurantUnavailable).toBe(true);
    expect(result.addableLines.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/reorder.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `features/orders/reorder.ts`**

```ts
import { Order, Restaurant, MenuItem, CartLineItem } from "../../types/domain";
import { calculateLineItemPrice } from "../../lib/pricing/calculate";

export interface ReorderResult {
  addableLines: CartLineItem[];
  unavailableItems: { name: string; reason: string }[];
  restaurantUnavailable: boolean;
}

export function buildReorderCart(order: Order, restaurant: Restaurant | null, currentMenuItems: MenuItem[]): ReorderResult {
  if (!restaurant || !restaurant.isOpen) {
    return { addableLines: [], unavailableItems: [], restaurantUnavailable: true };
  }

  const addableLines: CartLineItem[] = [];
  const unavailableItems: { name: string; reason: string }[] = [];

  for (const orderItem of order.items) {
    const current = currentMenuItems.find((m) => m.id === orderItem.menuItemId);
    if (!current) {
      unavailableItems.push({ name: orderItem.name, reason: "This item is no longer available on the menu" });
      continue;
    }
    if (!current.isAvailable) {
      unavailableItems.push({ name: orderItem.name, reason: "This item is temporarily unavailable" });
      continue;
    }
    addableLines.push({
      lineId: `${current.id}-reorder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: current.id,
      restaurantId: current.restaurantId,
      quantity: orderItem.quantity,
      customization: orderItem.customization,
      unitPrice: calculateLineItemPrice(current, orderItem.customization), // current price, never the historical one
    });
  }

  return { addableLines, unavailableItems, restaurantUnavailable: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/reorder.test.ts
```

Expected: PASS (4/4 tests)

- [ ] **Step 5: Implement `components/orders/OrderCard.tsx`** — restaurant name, placed date (formatted via a new `lib/formatting/datetime.ts` `formatOrderDate(iso: string): string`), item count + first-item preview text, total, a status `Badge` (color-mapped: placed/confirmed/preparing = primary tone, out_for_delivery/picked_up = primary tone with a truck-ish icon, delivered = success tone, cancelled/failed = muted/red tone), "Track Order" button (only for non-terminal statuses) → `/tracking/[id]`, "View Details" → `/order-details/[id]`, "Reorder" button → calls `buildReorderCart` then either navigates straight to `/cart` (all items addable) or opens a confirm step listing unavailable items first (reuse `Alert.alert` with a custom message, or a small inline expandable list — prefer the inline list so unavailable reasons are visible, with a final "Add Available Items to Cart" button).

- [ ] **Step 6: Add `lib/formatting/datetime.ts`**

```ts
export function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
```

- [ ] **Step 7: Implement `components/orders/TrackingTimeline.tsx`** — vertical stepper over the 7 statuses (`placed`→`delivered`), current/past steps filled in primary color with a check icon, future steps greyed, cancelled/failed renders a distinct red terminal step replacing the remaining ones.

- [ ] **Step 8: Implement `app/tracking/[orderId].tsx`** — fetches the order via `useQuery(["order", orderId], () => getOrderById(orderId))`; renders `TrackingTimeline`, ETA text, a clearly labeled "Simulated tracking (development mode)" caption, restaurant contact (phone from seed, tappable `Linking.openURL("tel:...")`), and a help entry point (→ `/profile/help`). Implement the status progression as a local simulation: a `useEffect` interval (every 8s) that advances `updateOrderStatus` through the status sequence while the screen is mounted and the order isn't yet terminal, re-fetching after each update — explicitly NOT claimed as real GPS/live backend tracking anywhere in the UI copy.

- [ ] **Step 9: Implement `app/order-details/[orderId].tsx`** — static receipt view: items with customization summaries, full `PriceBreakdown`-shaped totals (reuse the component by constructing a `CartTotals`-shaped object straight from the stored `Order` fields), address used, payment method, and a "Reorder" button reusing the same `buildReorderCart` flow as `OrderCard`.

- [ ] **Step 10: Implement `app/(tabs)/orders.tsx`** — `useQuery(["orders"], getOrders)`, split into "Active" (status not in `delivered`/`cancelled`/`failed`) rendered first/prominently, then "Previous Orders" below; `EmptyState` ("No orders yet" → "Browse Restaurants") when the list is empty; pull-to-refresh via `RefreshControl` on the `FlatList` calling `refetch()`.

- [ ] **Step 11: Manual smoke test**

```bash
npx expo start --clear
```

Expected: placing an order from Task 15 appears here as "Active" and its status visibly advances every ~8s on the tracking screen until "Delivered"; reordering a historical order with a since-unavailable item shows that item flagged and only adds the remaining items to cart after explicit confirmation.

- [ ] **Step 12: Commit**

```bash
git add components/orders app/order-confirmation app/tracking app/order-details app/\(tabs\)/orders.tsx features/orders tests/reorder.test.ts lib/formatting/datetime.ts
git commit -m "feat: implement order confirmation, simulated tracking, orders list, and validated reorder flow"
```

---

### Task 17: Favorites, Personalization/Recommendations, Preferences Editing

**Files:**
- Create: `app/(tabs)/favorites.tsx`
- Create: `features/recommendations/recommend.ts`
- Create: `app/profile/edit.tsx` (preferences portion only — profile-field editing is Task 18)

**Interfaces:**
- Consumes: `useFavoritesStore`, `getOrders`, `usePreferencesStore`, `SEED_RESTAURANTS`/`SEED_MENU_ITEMS`
- Produces: `getRecommendations(input: { orders: Order[]; favoriteRestaurantIds: string[]; preferences: Preferences; restaurants: Restaurant[] }): { reason: string; restaurants: Restaurant[] }[]` — each returned group carries its own honest `reason` string (e.g. "Order Again", "Based on Your Favorites") and groups are omitted entirely (not shown empty) when the user has no relevant signal yet, per spec §16.

- [ ] **Step 1: Implement `features/recommendations/recommend.ts`**

```ts
import { Order, Restaurant, User } from "../../types/domain";
import { Preferences } from "../../store/preferences-store";

export interface RecommendationGroup {
  reason: string;
  restaurants: Restaurant[];
}

export function getRecommendations(input: {
  orders: Order[];
  favoriteRestaurantIds: string[];
  preferences: Preferences;
  restaurants: Restaurant[];
}): RecommendationGroup[] {
  const groups: RecommendationGroup[] = [];

  const orderedRestaurantIds = [...new Set(input.orders.map((o) => o.restaurantId))];
  if (orderedRestaurantIds.length > 0) {
    const restaurants = input.restaurants.filter((r) => orderedRestaurantIds.includes(r.id));
    if (restaurants.length) groups.push({ reason: "Order Again", restaurants });
  }

  if (input.favoriteRestaurantIds.length > 0) {
    const restaurants = input.restaurants.filter(
      (r) => !input.favoriteRestaurantIds.includes(r.id) && r.cuisines.some((c) => input.restaurants.find((f) => input.favoriteRestaurantIds.includes(f.id))?.cuisines.includes(c))
    );
    if (restaurants.length) groups.push({ reason: "Based on Your Favorites", restaurants });
  }

  if (input.preferences.budgetPerMeal) {
    const restaurants = input.restaurants.filter((r) => {
      const maxForRange = { 1: 200, 2: 400, 3: 1000 }[r.priceRange];
      return input.preferences.budgetPerMeal! <= maxForRange;
    });
    if (restaurants.length) groups.push({ reason: `Recommended for Your Budget (under ₹${input.preferences.budgetPerMeal})`, restaurants });
  }

  if (groups.length === 0) {
    groups.push({ reason: "Popular Right Now", restaurants: [...input.restaurants].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 6) });
  }

  return groups;
}
```

- [ ] **Step 2: Wire `getRecommendations` into `app/(tabs)/home.tsx`'s "Recommended for You" section**, replacing the Task 10 placeholder inline helper: call it with live `useQuery(["orders"], getOrders)`, `useFavoritesStore().restaurantIds`, `usePreferencesStore().preferences`, and the restaurant list already fetched on that screen; render one `HorizontalCarousel` per returned group using its `reason` as the `SectionHeader` title (so the honesty requirement — never claim personalization with no signal — is structurally guaranteed by the function itself falling back to "Popular Right Now").

- [ ] **Step 3: Implement `app/(tabs)/favorites.tsx`** — two tabs/segments ("Restaurants" / "Dishes") via a simple segmented control (no extra nav library needed — local `useState<"restaurants"|"dishes">`); Restaurants segment renders favorited `RestaurantCard`s resolved from `useFavoritesStore().restaurantIds` against `SEED_RESTAURANTS`; Dishes segment renders favorited `FoodCard`s (with a working "Add" button) resolved against `SEED_MENU_ITEMS`; `EmptyState` per segment when empty ("No favorite restaurants yet" / "No favorite dishes yet", each with a "Browse" action to `/(tabs)/explore`). Call `useFavoritesStore().load()` once on mount if `!loaded`.

- [ ] **Step 4: Implement preference editing in `app/profile/edit.tsx`** (profile fields added in Task 18 — this task adds the preferences section only): veg-only toggle (`Switch`), multi-select cuisine chips (toggle membership in `favoriteCuisines`), and a budget-per-meal numeric input, all bound to `usePreferencesStore().setPreferences`.

- [ ] **Step 5: Manual smoke test**

```bash
npx expo start --clear
```

Expected: a brand-new install shows only "Popular Right Now" on Home; after placing one order (Task 15/16) and favoriting one restaurant (Task 10/12), "Order Again" and "Based on Your Favorites" sections appear; toggling favorites updates the Favorites tab immediately in both segments.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/favorites.tsx features/recommendations app/profile/edit.tsx app/\(tabs\)/home.tsx
git commit -m "feat: implement favorites screen and honest, signal-gated recommendations"
```

---

### Task 18: Profile, Settings, Help & Support, Notifications Screen

**Files:**
- Modify: `app/profile/edit.tsx` (add name/phone/email fields — preferences were added in Task 17)
- Create: `app/profile/settings.tsx`
- Create: `app/profile/help.tsx`
- Create: `app/(tabs)/profile.tsx`
- Create: `app/notifications/index.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, `signOut` (Task 5), `useNotificationsStore` (Task 6)
- Produces: logout clears `useAuthStore().setUser(null)`, calls `signOut()`, and `router.replace("/auth/login")`.

- [ ] **Step 1: Implement `app/(tabs)/profile.tsx`** — avatar (initials circle from `user.name` when no photo, since photo upload is out of scope for this sub-project), name/phone/email, and a list of `Pressable` rows with icons (lucide `MapPin`→`/addresses`, `ReceiptText`→`/(tabs)/orders`, `Heart`→`/(tabs)/favorites`, `SlidersHorizontal`→`/profile/edit`, `Bell`→`/notifications`, `Settings`→`/profile/settings`, `CircleHelp`→`/profile/help`), a guest-mode banner with "Sign in" CTA when `user.isGuest`, and a "Log Out" row (hidden for guests, or relabeled "Exit Guest Mode") that confirms via `Alert.alert` before executing.

- [ ] **Step 2: Add name/phone/email editing to `app/profile/edit.tsx`** — `useForm` with a small inline Zod schema (`name: min 2`, `email: z.string().email().optional()`), pre-filled from `useAuthStore().user`, "Save" updates `useAuthStore().setUser({...user, ...values})` (no backend to persist to yet — this is explicitly local-session-only for this sub-project, which is acceptable since auth itself is mock).

- [ ] **Step 3: Implement `app/profile/settings.tsx`** — notification preference toggles (order updates, promotions — local state only, persisted via a tiny `AsyncStorage` key, read on mount), a link to Terms & Privacy (render a static scrollable text screen inline — do not fabricate a real legal document; label it "Sample Terms (Demo)"), and app version info.

- [ ] **Step 4: Implement `app/profile/help.tsx`** — FAQ accordion (collapsible `Pressable` + conditional body, 5-6 common questions: "Where is my order", "How do refunds work", "How do I change my address", etc. — answers can reference the dev-mode nature of payments/tracking honestly), and a "Contact Support" row that opens `Linking.openURL("mailto:support@example.com")` labeled as a placeholder support channel.

- [ ] **Step 5: Implement `app/notifications/index.tsx`** — `FlatList` over `useNotificationsStore().items`, calling `markAllRead()` on mount; each row shows title/body/relative time; `EmptyState` when empty ("No notifications yet"). Wire `services/orders.ts`'s status-advance simulation (Task 16, Step 8) to also call `useNotificationsStore().push(...)` on each status change (import the store from the tracking screen's interval callback) so notifications and tracking stay consistent — e.g. "Your order from Biryani Junction is out for delivery!".

- [ ] **Step 6: Manual smoke test**

```bash
npx expo start --clear
```

Expected: editing profile fields persists for the session; settings toggles persist across reload; help FAQ expands/collapses; notifications populate as a tracked order's status advances and the bell badge on Home (Task 10) reflects `unreadCount`.

- [ ] **Step 7: Commit**

```bash
git add app/profile app/\(tabs\)/profile.tsx app/notifications
git commit -m "feat: implement profile, settings, help/support, and in-app notifications"
```

---

### Task 19: AI Assistant (Deterministic Fallback Mode)

**Files:**
- Create: `components/assistant/ChatBubble.tsx`
- Create: `components/assistant/ResultCard.tsx`
- Create: `services/assistant.ts`
- Create: `app/assistant/index.tsx`

**Interfaces:**
- Consumes: `filterRestaurants`, `SEED_MENU_ITEMS`, `useCartStore`
- Produces: `interpretPrompt(prompt: string): AssistantQuery` (pure parser) and `runAssistantQuery(query: AssistantQuery): AssistantResult` (pure, operates only over seed data — never invents a restaurant/price/rating, satisfying spec §15's hard requirement), where `AssistantResult = { message: string; restaurants: Restaurant[]; items: MenuItem[] }`. This sub-project implements fallback mode only — a real LLM backend is sub-project 3's job; the UI must render a visible "Crave AI (offline smart-match mode)" badge so the fallback is never mistaken for a live model.

- [ ] **Step 1: Implement `services/assistant.ts`**

```ts
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { Restaurant, MenuItem } from "../types/domain";

export interface AssistantQuery {
  maxBudget?: number;
  vegOnly?: boolean;
  cuisineKeywords: string[];
  wantsSpicy?: boolean;
  wantsHighRated?: boolean;
}

export interface AssistantResult {
  message: string;
  restaurants: Restaurant[];
  items: MenuItem[];
}

const CUISINE_KEYWORDS = ["biryani", "pizza", "burger", "chinese", "south indian", "north indian", "dessert", "healthy", "street food", "beverage"];

export function interpretPrompt(prompt: string): AssistantQuery {
  const text = prompt.toLowerCase();
  const budgetMatch = text.match(/under\s*₹?\s*(\d+)/) ?? text.match(/below\s*₹?\s*(\d+)/);
  return {
    maxBudget: budgetMatch ? Number(budgetMatch[1]) : undefined,
    vegOnly: /vegetarian|veg\b|jain/.test(text),
    cuisineKeywords: CUISINE_KEYWORDS.filter((k) => text.includes(k)),
    wantsSpicy: /spicy/.test(text),
    wantsHighRated: /highly rated|best|top rated/.test(text),
  };
}

export function runAssistantQuery(query: AssistantQuery): AssistantResult {
  let items: MenuItem[] = SEED_MENU_ITEMS.filter((i) => i.isAvailable);
  if (query.maxBudget) items = items.filter((i) => i.basePrice <= query.maxBudget!);
  if (query.vegOnly) items = items.filter((i) => i.vegFlag === "veg");
  if (query.cuisineKeywords.length) {
    const restaurantIds = new Set(
      SEED_RESTAURANTS.filter((r) => r.cuisines.some((c) => query.cuisineKeywords.some((k) => c.toLowerCase().includes(k)))).map((r) => r.id)
    );
    items = items.filter((i) => restaurantIds.has(i.restaurantId));
  }
  if (query.wantsSpicy) items = items.filter((i) => i.supportsSpiceLevel);

  let restaurants = SEED_RESTAURANTS.filter((r) => items.some((i) => i.restaurantId === r.id));
  if (query.wantsHighRated) restaurants = [...restaurants].sort((a, b) => b.rating - a.rating);

  const topItems = items.slice(0, 6);
  const topRestaurants = restaurants.slice(0, 4);

  const message = topItems.length
    ? `Here's what matches, based on real menu data: ${topItems.length} dish${topItems.length > 1 ? "es" : ""} across ${topRestaurants.length} restaurant${topRestaurants.length > 1 ? "s" : ""}.`
    : "I couldn't find a match in the current menu. Try loosening your budget or dietary filter.";

  return { message, restaurants: topRestaurants, items: topItems };
}
```

- [ ] **Step 2: Implement `components/assistant/ChatBubble.tsx`** — simple left/right-aligned rounded bubble (`role: "user" | "assistant"`), assistant bubbles get a small `ASSISTANT_NAME` label above them.

- [ ] **Step 3: Implement `components/assistant/ResultCard.tsx`** — compact card for a restaurant or menu item result inside the chat (image thumbnail, name, price/rating line, and for menu items an "Add to Cart" button that calls `useCartStore().addItem` directly when the item has no required option groups, otherwise navigates to `/food/[id]` — the assistant never adds to cart without this explicit per-item tap, per spec §15's "never place an order without confirmation").

- [ ] **Step 4: Implement `app/assistant/index.tsx`** — header shows `ASSISTANT_NAME` + a `Badge` reading "Offline smart-match mode" (fixed, since no AI key exists in this sub-project), a scrollable message list (`FlatList` of `ChatBubble`/`ResultCard`s), 3-4 tappable example-prompt chips above the input when the conversation is empty (from spec §15's example list), and a bottom `TextField`+send button that on submit: appends the user bubble, runs `interpretPrompt` → `runAssistantQuery`, appends an assistant bubble with the message plus `ResultCard`s for each returned restaurant/item.

- [ ] **Step 5: Manual smoke test**

```bash
npx expo start --clear
```

Expected: "Find vegetarian dinner under ₹250" returns only veg items ≤₹250 with correct restaurants; a nonsense prompt returns the "couldn't find a match" message without crashing; tapping "Add to Cart" on a simple result actually adds it (verify in `/cart`).

- [ ] **Step 6: Commit**

```bash
git add components/assistant services/assistant.ts app/assistant
git commit -m "feat: implement Crave AI assistant in deterministic offline fallback mode"
```

---

### Task 20: Offline/Error Handling Pass, Image Fallbacks, Final Lint/Typecheck/Test Sweep

**Files:**
- Create: `components/ui/ImageWithFallback.tsx`
- Create: `hooks/useNetworkStatus.ts`
- Modify: any screen component still using raw `<Image>` for restaurant/food photography (sweep `components/home`, `components/restaurant`, `components/food`, `components/orders`, `components/assistant`) to use `ImageWithFallback`
- Modify: `app/_layout.tsx` (mount a global offline banner)

**Interfaces:**
- Consumes: `expo-constants`/network state
- Produces: `<ImageWithFallback uri ... />` renders a neutral placeholder (icon + light background, not a broken-image glyph) on load error; `useNetworkStatus(): { isOnline: boolean }` drives a persistent top banner ("You're offline — some actions may not work") without blocking rendering of already-loaded local data.

- [ ] **Step 1: Install network-state dependency**

```bash
npx expo install @react-native-community/netinfo
```

- [ ] **Step 2: Implement `hooks/useNetworkStatus.ts`**

```ts
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true));
    return unsubscribe;
  }, []);

  return { isOnline };
}
```

- [ ] **Step 3: Implement `components/ui/ImageWithFallback.tsx`**

```tsx
import React, { useState } from "react";
import { Image, View, ImageProps } from "react-native";
import { ImageOff } from "lucide-react-native";

export function ImageWithFallback({ uri, className, style }: { uri: string; className?: string; style?: ImageProps["style"] }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View className={`bg-border items-center justify-center ${className ?? ""}`} style={style}>
        <ImageOff size={24} color="#777777" />
      </View>
    );
  }

  return <Image source={{ uri }} className={className} style={style} onError={() => setFailed(true)} resizeMode="cover" />;
}
```

- [ ] **Step 4: Sweep existing image usages** — replace every direct `<Image source={{uri: ...}}>` in `components/home/RestaurantCard.tsx`, `components/home/FoodCard.tsx`, `components/restaurant/MenuItemRow.tsx`, `app/restaurant/[id].tsx` (hero image), `components/food/CustomizationSheet.tsx`, `components/orders/OrderCard.tsx` (if it renders an image), and `components/assistant/ResultCard.tsx` with `<ImageWithFallback uri={...} className={...} />`, preserving each call site's existing sizing classes.

- [ ] **Step 5: Mount the offline banner in `app/_layout.tsx`** — import `useNetworkStatus`, render a thin red/amber banner `View` (`"You're offline"`) absolutely positioned at the top, conditionally rendered when `!isOnline`, above the `Stack` (inside the same `SafeAreaProvider`, as a sibling before `Stack`).

- [ ] **Step 6: Run the full automated check sweep**

```bash
npx tsc --noEmit
npx jest
npx expo-doctor
```

Fix any TypeScript errors, failing tests, or `expo-doctor` warnings introduced by this sub-project's own code (do not chase pre-existing warnings from third-party packages that `expo-doctor` cannot resolve — note those as known limitations instead of forcing version changes that could break compatibility).

- [ ] **Step 7: Run a production export as a build sanity check**

```bash
npx expo export --platform android
```

Expected: completes without bundling errors (confirms no dangling imports/missing assets across the whole app tree built in Tasks 1-19).

- [ ] **Step 8: Commit**

```bash
git add components/ui/ImageWithFallback.tsx hooks/useNetworkStatus.ts components app/_layout.tsx
git commit -m "feat: add offline banner and image-load fallbacks; final typecheck/test/export sweep"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the original request's §§1–14, 16–18 relevant to the customer-local scope is covered by a task; §15 (AI assistant) is covered in fallback mode only — §15's server/LLM-backed half is explicitly deferred to sub-project 3 and is called out as such in Task 19; §19 auth is covered as mock/guest only (real Supabase Auth is sub-project 2); §20 (DB/backend), §21 (push notifications), §25 (admin) are explicitly out of scope for this plan and deferred to sub-projects 2–4; §26 (testing) is covered for the units this plan can meaningfully unit-test (pricing, cart, coupons, search filters, reorder, seed-data integrity) — full E2E device testing isn't included since it requires a configured device/simulator and is left as a documented manual smoke-test step per task instead.
- **Placeholder scan:** no TBD/TODO markers remain except the intentional, labeled `TODO: implement this screen` placeholder text created transiently in Task 8 Step 5 and overwritten by name in every subsequent task — by Task 19's end no placeholder route remains unimplemented.
- **Type consistency:** `CartLineItem`, `CartCustomization`, `Order`, `MenuItem` field names are defined once in Task 2 and referenced identically (same field names/casing) through Tasks 4–19; `CartTotals` is defined once in Task 4 and reused by name in Tasks 14, 16.
- **Scope check:** this plan is intentionally Sub-project 1 only (Foundation + Customer UI, local data). Supabase backend, real AI provider, push notifications, and loyalty/admin are separate sub-projects per the brainstorming decomposition and are not tasks here.
