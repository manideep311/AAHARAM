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
