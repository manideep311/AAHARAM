// Thin, side-effecting bridge between buildReorderCart's pure result and the cart store's
// existing mutation API. Deliberately NOT part of reorder.ts (which stays a pure, independently
// testable function per the task brief) and NOT a new cart-store action -- it just sequences the
// two store actions that already exist: the first addable line replaces the cart for the
// reordered restaurant (matching how "add from a different restaurant" already works elsewhere
// in the app), and any further lines are added on top with the ordinary addItem call.
import { MenuItem } from "../../types/domain";
import { useCartStore } from "../../store/cart-store";
import { ReorderResult } from "./reorder";

export function applyReorderToCart(result: ReorderResult, currentMenuItems: MenuItem[]): void {
  const store = useCartStore.getState();

  result.addableLines.forEach((line, index) => {
    const item = currentMenuItems.find((m) => m.id === line.menuItemId);
    if (!item) return; // Should not happen -- buildReorderCart only emits lines for items it found -- but guard defensively.

    if (index === 0) {
      store.replaceCartForNewRestaurant(item, line.customization, line.quantity);
    } else {
      store.addItem(item, line.customization, line.quantity);
    }
  });
}
