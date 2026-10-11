// Shared "tap Reorder" flow used by both OrderCard and the order-details screen: fetch the
// restaurant + its current menu, run the pure buildReorderCart validation, then either apply
// directly to the cart and navigate there, or surface unavailable items and wait for the user to
// explicitly confirm adding just the available ones. Kept as a hook (not duplicated inline in
// each screen) so both call sites share one implementation of this logic.
import { useState } from "react";
import { router } from "expo-router";
import { Order, MenuItem } from "../../types/domain";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { buildReorderCart, ReorderResult } from "./reorder";
import { applyReorderToCart } from "./applyReorderToCart";

export type ReorderPhase = "idle" | "loading" | "restaurant-unavailable" | "needs-confirmation" | "error";

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
        applyReorderToCart(built, menu.items);
        setPhase("idle");
        router.push("/cart");
        return;
      }
      setPhase("needs-confirmation");
    } catch {
      setPhase("error");
    }
  }

  function confirmPartialReorder() {
    if (!result) return;
    applyReorderToCart(result, resolvedMenuItems);
    setPhase("idle");
    setResult(null);
    router.push("/cart");
  }

  function dismiss() {
    setPhase("idle");
    setResult(null);
  }

  return { phase, result, startReorder, confirmPartialReorder, dismiss };
}
