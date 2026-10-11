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
