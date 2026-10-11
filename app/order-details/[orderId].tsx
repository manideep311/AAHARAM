import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, AlertTriangle, MapPin, Smartphone, CreditCard, Landmark, Banknote, LucideIcon, ChevronDown, ChevronUp, RefreshCw } from "lucide-react-native";
import { getOrderById } from "../../services/orders";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { getAddresses } from "../../services/addresses";
import { PriceBreakdown } from "../../components/cart/PriceBreakdown";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatCurrency } from "../../lib/formatting/currency";
import { formatOrderDate } from "../../lib/formatting/datetime";
import { ORDER_STATUS_LABELS, orderStatusTone, orderStatusIcon } from "../../features/orders/status";
import { useReorderFlow } from "../../features/orders/useReorderFlow";
import { CartTotals } from "../../lib/pricing/calculate";
import { OrderItem, MenuItem, PaymentMethod, SpiceLevel } from "../../types/domain";
import { colors } from "../../constants/theme";

function Header({ topInset }: { topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        Order Details
      </Text>
    </View>
  );
}

const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  upi: { label: "UPI", icon: Smartphone },
  card: { label: "Credit / Debit Card", icon: CreditCard },
  netbanking: { label: "Net Banking", icon: Landmark },
  cod: { label: "Cash on Delivery", icon: Banknote },
};

const SPICE_LABELS: Record<SpiceLevel, string> = {
  mild: "Mild spice",
  medium: "Medium spice",
  spicy: "Spicy",
};

// Builds a one-line customization summary from the order item's stored selections. Option/add-on
// LABELS (not just ids) are only resolvable if the matching current MenuItem is still around --
// for a vanished item we fall back to what's independent of the live menu (spice level, note).
function buildItemSummary(item: OrderItem, menuItem: MenuItem | undefined): string {
  const segments: string[] = [];

  if (menuItem) {
    const optionLabels = menuItem.optionGroups
      .map((group) => group.options.find((o) => o.id === item.customization.optionSelections[group.id])?.label)
      .filter((label): label is string => !!label);
    if (optionLabels.length > 0) segments.push(optionLabels.join(", "));

    const addOnLabels = item.customization.addOnIds
      .map((id) => menuItem.addOns.find((a) => a.id === id)?.name)
      .filter((name): name is string => !!name);
    if (addOnLabels.length > 0) segments.push(addOnLabels.join(", "));
  }

  if (item.customization.spiceLevel) segments.push(SPICE_LABELS[item.customization.spiceLevel]);
  if (item.customization.specialInstructions) segments.push(`Note: ${item.customization.specialInstructions}`);

  return segments.join(" · ");
}

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [unavailableExpanded, setUnavailableExpanded] = useState(true);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId as string),
    enabled: !!orderId,
  });
  const order = orderQuery.data;

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", order?.restaurantId],
    queryFn: () => getRestaurantById(order!.restaurantId),
    enabled: !!order?.restaurantId,
  });
  const restaurant = restaurantQuery.data;

  const menuQuery = useQuery({
    queryKey: ["menu", order?.restaurantId],
    queryFn: () => getMenuForRestaurant(order!.restaurantId),
    enabled: !!order?.restaurantId,
  });
  const menuItems = menuQuery.data?.items ?? [];

  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const address = addressesQuery.data?.find((a) => a.id === order?.addressId);

  // Called unconditionally (Rules of Hooks) -- useReorderFlow is a no-op until `order` resolves.
  const reorder = useReorderFlow(order ?? null);

  if (!orderId) {
    return (
      <View className="flex-1 bg-bg">
        <Header topInset={insets.top} />
        <EmptyState icon={AlertTriangle} title="Order not found" />
      </View>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Header topInset={insets.top} />
        <View className="px-4 py-2">
          <Skeleton width="100%" height={100} />
          <View className="mt-3">
            <Skeleton width="100%" height={160} />
          </View>
          <View className="mt-3">
            <Skeleton width="100%" height={160} />
          </View>
        </View>
      </View>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <View className="flex-1 bg-bg">
        <Header topInset={insets.top} />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load this order"
          description="Please try again."
          actionLabel="Retry"
          onAction={() => orderQuery.refetch()}
        />
      </View>
    );
  }

  // The order already carries its own final numbers from checkout time -- no recalculation
  // against the live menu is needed (or correct) for a historical receipt. freeDelivery is only
  // inferred true when a coupon was applied and it zeroed out the fee, so a restaurant whose
  // normal delivery fee happens to be 0 doesn't get a spurious "FREE" badge.
  const totals: CartTotals = {
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    freeDelivery: !!order.couponCode && order.deliveryFee === 0,
  };

  const paymentMeta = PAYMENT_METHOD_META[order.paymentMethod];
  const PaymentIcon = paymentMeta.icon;
  const StatusIcon = orderStatusIcon(order.status);
  const { phase, result, startReorder, confirmPartialReorder } = reorder;

  return (
    <View className="flex-1 bg-bg">
      <Header topInset={insets.top} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32 }}>
        <Card className="mb-4 p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-bold text-ink">{order.restaurantName}</Text>
              <Text className="mt-0.5 text-xs text-muted">Order #{order.id}</Text>
              <Text className="mt-0.5 text-xs text-muted">{formatOrderDate(order.placedAt)}</Text>
            </View>
            <Badge label={ORDER_STATUS_LABELS[order.status]} tone={orderStatusTone(order.status)} icon={StatusIcon} />
          </View>
        </Card>

        <Card className="mb-4 p-4">
          <Text className="mb-2 text-sm font-bold text-ink">Items</Text>
          {order.items.map((item, i) => {
            const menuItem = menuItems.find((m) => m.id === item.menuItemId);
            const summary = buildItemSummary(item, menuItem);
            return (
              <View key={`${item.menuItemId}-${i}`} className={i > 0 ? "mt-3" : ""}>
                <View className="flex-row items-start justify-between">
                  <Text className="flex-1 pr-3 text-sm font-semibold text-ink">
                    {item.quantity} × {item.name}
                  </Text>
                  <Text className="text-sm font-semibold text-ink">{formatCurrency(item.unitPrice * item.quantity)}</Text>
                </View>
                {summary ? <Text className="mt-0.5 text-xs text-muted">{summary}</Text> : null}
              </View>
            );
          })}
        </Card>

        <View className="mb-4">
          <PriceBreakdown totals={totals} originalDeliveryFee={restaurant?.deliveryFee} />
        </View>

        <Card className="mb-4 p-4">
          <View className="flex-row items-start">
            <MapPin size={18} color={colors.primary} />
            <View className="ml-2 flex-1">
              <Text className="text-sm font-bold text-ink">Delivery Address</Text>
              {address ? (
                <>
                  <Text className="mt-1 text-sm text-ink">
                    {address.recipientName} · {address.phone}
                  </Text>
                  <Text className="mt-0.5 text-sm text-muted">
                    {address.line1}, {address.area}, {address.city}, {address.state} {address.postalCode}
                  </Text>
                </>
              ) : (
                <Text className="mt-1 text-sm text-muted">This address is no longer saved to your account.</Text>
              )}
            </View>
          </View>
        </Card>

        <Card className="mb-4 p-4">
          <View className="flex-row items-center">
            <PaymentIcon size={18} color={colors.primary} />
            <Text className="ml-2 text-sm font-bold text-ink">{paymentMeta.label}</Text>
          </View>
        </Card>

        {phase === "restaurant-unavailable" ? (
          <View className="mb-4 flex-row items-start rounded-xl bg-danger/10 px-3 py-2.5">
            <AlertTriangle size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">
              {order.restaurantName} isn't accepting orders right now. Try reordering again later.
            </Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <View className="mb-4 flex-row items-start rounded-xl bg-danger/10 px-3 py-2.5">
            <AlertTriangle size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">Couldn't check this order's items. Please try again.</Text>
          </View>
        ) : null}

        {phase === "needs-confirmation" && result ? (
          <View className="mb-4 rounded-xl border border-border px-3 py-2.5">
            <Pressable
              onPress={() => setUnavailableExpanded((e) => !e)}
              accessibilityRole="button"
              accessibilityLabel={unavailableExpanded ? "Hide unavailable items" : "Show unavailable items"}
              className="flex-row items-center justify-between"
            >
              <Text className="flex-1 text-xs font-semibold text-danger">
                {result.unavailableItems.length} item{result.unavailableItems.length > 1 ? "s" : ""} can't be reordered
              </Text>
              {unavailableExpanded ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
            </Pressable>
            {unavailableExpanded ? (
              <View className="mt-2">
                {result.unavailableItems.map((item, i) => (
                  <Text key={`${item.name}-${i}`} className="mt-1 text-xs text-muted">
                    • {item.name} — {item.reason}
                  </Text>
                ))}
                {result.addableLines.length > 0 ? (
                  <View className="mt-3">
                    <Button
                      title="Add Available Items to Cart"
                      size="md"
                      accessibilityLabel="Add available items to cart"
                      onPress={confirmPartialReorder}
                    />
                  </View>
                ) : (
                  <Text className="mt-2 text-xs text-muted">None of these items are currently available to reorder.</Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={startReorder}
          disabled={phase === "loading"}
          accessibilityRole="button"
          accessibilityLabel="Reorder"
          className={`flex-row items-center justify-center rounded-xl bg-primary px-4 py-3.5 ${phase === "loading" ? "opacity-60" : ""}`}
        >
          {phase === "loading" ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <RefreshCw size={16} color="#fff" />
              <Text className="ml-2 text-base font-semibold text-white">Reorder</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
