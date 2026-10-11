// Shared "tap Reorder" flow used by both OrderCard and the order-details screen: fetch the
// restaurant + its current menu, run the pure buildReorderCart validation, then either apply
// directly to the cart and navigate there, or surface unavailable items and wait for the user to
// explicitly confirm adding just the available ones. Kept as a hook (not duplicated inline in
// each screen) so both call sites share one implementation of this logic.
import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { Order, MenuItem } from "../../types/domain";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { useCartStore } from "../../store/cart-store";
import { buildReorderCart, ReorderResult } from "./reorder";
import { applyReorderToCart } from "./applyReorderToCart";

export type ReorderPhase = "idle" | "loading" | "restaurant-unavailable" | "needs-confirmation" | "error";

// Mirrors the exact cross-restaurant confirm dialog already used at every other add-to-cart call
// site (app/food/[id].tsx, MenuItemRow, FoodCard, ResultCard): same copy, same two buttons. A
// reorder target whose restaurant differs from a non-empty current cart must go through this
// same confirmation instead of silently blowing away the user's in-progress cart.
function applyReorderWithConflictCheck(
  built: ReorderResult,
  menuItems: MenuItem[],
  targetRestaurantId: string,
  onApplied: () => void
) {
  const cart = useCartStore.getState();
  const hasConflict = cart.restaurantId !== null && cart.lines.length > 0 && cart.restaurantId !== targetRestaurantId;

  if (hasConflict) {
    Alert.alert(
      "Start a new cart?",
      "Your cart has items from a different restaurant. Adding this item will clear your current cart and start a new one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start New Cart",
          style: "destructive",
          onPress: () => {
            applyReorderToCart(built, menuItems);
            onApplied();
          },
        },
      ]
    );
    return;
  }

  applyReorderToCart(built, menuItems);
  onApplied();
}

// `order` is nullable so call sites that only have the order once a query resolves can call this
// hook unconditionally (satisfying the Rules of Hooks) and simply get a no-op flow until it's set.
export function useReorderFlow(order: Order | null) {
  const [phase, setPhase] = useState<ReorderPhase>("idle");
  const [result, setResult] = useState<ReorderResult | null>(null);
  const [resolvedMenuItems, setResolvedMenuItems] = useState<MenuItem[]>([]);

  async function startReorder() {
    if (!order || phase === "loading") return;
    setPhase("loading");
    try {
      const [restaurant, menu] = await Promise.all([
        getRestaurantById(order.restaurantId),
        getMenuForRestaurant(order.restaurantId),
      ]);
      const built = buildReorderCart(order, restaurant, menu.items);
      setResult(built);
      setResolvedMenuItems(menu.items);

      if (built.restaurantUnavailable) {
        setPhase("restaurant-unavailable");
        return;
      }
      if (built.unavailableItems.length === 0) {
        // Reset to idle before the (possibly conflict-confirming) apply step so the card's
        // "loading" spinner doesn't keep spinning while a native Alert is on screen.
        setPhase("idle");
        applyReorderWithConflictCheck(built, menu.items, order.restaurantId, () => router.push("/cart"));
        return;
      }
      setPhase("needs-confirmation");
    } catch {
      setPhase("error");
    }
  }

  function confirmPartialReorder() {
    if (!result || !order) return;
    setPhase("idle");
    setResult(null);
    applyReorderWithConflictCheck(result, resolvedMenuItems, order.restaurantId, () => router.push("/cart"));
  }

  function dismiss() {
    setPhase("idle");
    setResult(null);
  }

  return { phase, result, startReorder, confirmPartialReorder, dismiss };
}
