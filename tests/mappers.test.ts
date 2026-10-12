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
