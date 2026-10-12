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
