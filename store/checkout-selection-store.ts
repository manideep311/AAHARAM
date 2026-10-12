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
