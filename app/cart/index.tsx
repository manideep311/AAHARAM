import React, { useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, AlertTriangle, ShoppingBag } from "lucide-react-native";
import { useCartStore } from "../../store/cart-store";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { validateCoupon } from "../../services/coupons";
import { calculateCartTotals } from "../../lib/pricing/calculate";
import { CartLineItemCard } from "../../components/cart/CartLineItem";
import { CouponRow } from "../../components/cart/CouponRow";
import { PriceBreakdown } from "../../components/cart/PriceBreakdown";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatCurrency } from "../../lib/formatting/currency";
import { colors } from "../../constants/theme";

function Header({ title, topInset }: { title: string; topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();

  const restaurantId = useCartStore((s) => s.restaurantId);
  const lines = useCartStore((s) => s.lines);
  const couponCode = useCartStore((s) => s.couponCode);

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => getRestaurantById(restaurantId as string),
    enabled: !!restaurantId,
  });

  // All cart lines share a single restaurant, so fetching its whole menu once and resolving
  // each line's menuItemId locally is simpler and cheaper than one query per line.
  const menuQuery = useQuery({
    queryKey: ["menu", restaurantId],
    queryFn: () => getMenuForRestaurant(restaurantId as string),
    enabled: !!restaurantId,
  });

  const restaurant = restaurantQuery.data;
  const menuItems = menuQuery.data?.items ?? [];

  // Subtotal doesn't depend on the coupon, so compute it first (coupon=null) to feed both
  // the min-order check and the coupon re-validation query below.
  const baseTotals = useMemo(
    () => (restaurant ? calculateCartTotals(lines, menuItems, restaurant, null) : null),
    [lines, menuItems, restaurant]
  );
  const subtotal = baseTotals?.subtotal ?? 0;

  // The stored coupon is just a code string; re-resolve it into a full Coupon object by
  // re-validating, the same way a server would re-check it at checkout time. React Query
  // dedupes/caches this against the identical query CouponRow fires, so there's no double work.
  const couponValidationQuery = useQuery({
    queryKey: ["coupon-validate", couponCode, subtotal, restaurantId],
    queryFn: () => validateCoupon(couponCode as string, subtotal, restaurantId as string),
    enabled: !!couponCode && !!restaurantId && !!restaurant,
  });

  const resolvedCoupon =
    couponValidationQuery.data && couponValidationQuery.data.ok ? couponValidationQuery.data.coupon : null;

  const totals = useMemo(
    () => (restaurant ? calculateCartTotals(lines, menuItems, restaurant, resolvedCoupon) : null),
    [lines, menuItems, restaurant, resolvedCoupon]
  );

  function findMenuItem(menuItemId: string) {
    return menuItems.find((m) => m.id === menuItemId);
  }

  if (lines.length === 0) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Your Cart" topInset={insets.top} />
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse restaurants and add some delicious food to get started."
          actionLabel="Browse Restaurants"
          onAction={() => router.push("/(tabs)/home")}
        />
      </View>
    );
  }

  const isLoading = restaurantQuery.isLoading || menuQuery.isLoading;
  const isError = restaurantQuery.isError || menuQuery.isError;

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Your Cart" topInset={insets.top} />
        <View className="px-4 py-2">
          <Skeleton width="100%" height={84} />
          <View className="mt-3">
            <Skeleton width="100%" height={84} />
          </View>
          <View className="mt-3">
            <Skeleton width="100%" height={140} />
          </View>
        </View>
      </View>
    );
  }

  if (isError || !restaurant) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Your Cart" topInset={insets.top} />
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="We couldn't load your cart. Please try again."
          actionLabel="Retry"
          onAction={() => {
            restaurantQuery.refetch();
            menuQuery.refetch();
          }}
        />
      </View>
    );
  }

  const belowMinOrder = subtotal < restaurant.minOrderAmount;
  const shortfall = restaurant.minOrderAmount - subtotal;

  return (
    <View className="flex-1 bg-bg">
      <Header title={restaurant.name} topInset={insets.top} />

      <FlatList
        data={lines}
        keyExtractor={(line) => line.lineId}
        renderItem={({ item }) => <CartLineItemCard line={item} menuItem={findMenuItem(item.menuItemId)} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 140 }}
        ListFooterComponent={
          <View>
            {belowMinOrder ? (
              <View className="mb-3 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
                <AlertTriangle size={16} color={colors.danger} />
                <Text className="ml-2 flex-1 text-sm font-semibold text-danger">
                  Add {formatCurrency(shortfall)} more to reach the {formatCurrency(restaurant.minOrderAmount)} minimum
                  order
                </Text>
              </View>
            ) : null}

            <CouponRow restaurantId={restaurant.id} subtotal={subtotal} />

            {totals ? (
              <View className="mt-1">
                <PriceBreakdown totals={totals} originalDeliveryFee={restaurant.deliveryFee} />
              </View>
            ) : null}
          </View>
        }
      />

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {totals ? (
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Total</Text>
            <Text className="text-lg font-bold text-ink">{formatCurrency(totals.total)}</Text>
          </View>
        ) : null}
        <Button
          title={belowMinOrder ? `Add ${formatCurrency(shortfall)} more to continue` : "Proceed to Checkout"}
          disabled={belowMinOrder}
          size="lg"
          accessibilityLabel={belowMinOrder ? `Minimum order not met, add ${formatCurrency(shortfall)} more` : "Proceed to Checkout"}
          onPress={() => router.push("/checkout")}
        />
      </View>
    </View>
  );
}
