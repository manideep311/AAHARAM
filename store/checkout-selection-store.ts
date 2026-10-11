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
