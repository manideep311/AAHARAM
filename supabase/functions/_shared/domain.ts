// Domain types shared by the Expo app (via types/domain.ts) and the Supabase Edge Functions.
// Pure TypeScript only: no imports outside supabase/functions/_shared.

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
  /** Dev-seed contact number, shown on the tracking screen as a tappable tel: link. */
  phone?: string;
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
