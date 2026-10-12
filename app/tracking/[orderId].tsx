import React from "react";
import { View, Text, ScrollView, Pressable, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, AlertTriangle, FlaskConical, Phone, HelpCircle, Clock, RotateCcw } from "lucide-react-native";
import { getOrderById, cancelOrder } from "../../services/orders";
import { getRestaurantById } from "../../services/restaurants";
import { TrackingTimeline } from "../../components/orders/TrackingTimeline";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatOrderDate } from "../../lib/formatting/datetime";
import { ORDER_STATUS_LABELS, isTerminalStatus } from "../../features/orders/status";
import { isCancellable } from "../../supabase/functions/_shared/place-order-core";
import { colors } from "../../constants/theme";

function Header({ topInset }: { topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        Track Order
      </Text>
    </View>
  );
}

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId as string),
    enabled: !!orderId,
    // Realtime normally pushes status changes; polling is the fallback if the socket drops.
    refetchInterval: (query) => {
      const current = query.state.data;
      return current && !isTerminalStatus(current.status) ? 30_000 : false;
    },
  });
  const order = orderQuery.data;

  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", orderId], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  function confirmCancel() {
    if (!order) return;
    Alert.alert(
      "Cancel this order?",
      order.paymentStatus === "paid_simulated"
        ? "Your simulated payment will be marked as refunded."
        : "The restaurant will be told not to prepare it.",
      [
        { text: "Keep order", style: "cancel" },
        { text: "Cancel order", style: "destructive", onPress: () => cancelMutation.mutate() },
      ]
    );
  }

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", order?.restaurantId],
    queryFn: () => getRestaurantById(order!.restaurantId),
    enabled: !!order?.restaurantId,
  });
  const restaurant = restaurantQuery.data;

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
          <Skeleton width="100%" height={120} />
          <View className="mt-3">
            <Skeleton width="100%" height={220} />
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

  const etaMinutes = order.etaMinutes ?? restaurant?.etaMinutes;
  const etaDate = etaMinutes ? new Date(new Date(order.placedAt).getTime() + etaMinutes * 60000) : null;
  const etaText =
    order.status === "delivered"
      ? "Delivered"
      : order.status === "cancelled" || order.status === "failed"
      ? ORDER_STATUS_LABELS[order.status]
      : etaDate
      ? `Arriving by ${etaDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
      : "Estimated time unavailable";

  return (
    <View className="flex-1 bg-bg">
      <Header topInset={insets.top} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32 }}>
        <View className="mb-4 flex-row items-start rounded-xl bg-primary/10 px-3 py-2.5">
          <FlaskConical size={16} color={colors.primary} />
          <Text className="ml-2 flex-1 text-xs font-semibold text-primary">
            Simulated tracking (development mode) -- a server job advances this order every 30 seconds to
            demonstrate the flow. There is no real courier or live GPS behind this screen.
          </Text>
        </View>

        <Card className="mb-4 p-4">
          <View className="flex-row items-center">
            <Clock size={18} color={colors.primary} />
            <Text className="ml-2 text-base font-bold text-ink">{etaText}</Text>
          </View>
          <Text className="mt-1 text-xs text-muted">Order placed {formatOrderDate(order.placedAt)}</Text>
        </Card>

        <Card className="mb-4 p-4">
          <TrackingTimeline status={order.status} />
        </Card>

        {order.paymentStatus === "refunded_simulated" ? (
          <View className="mb-4 flex-row items-center rounded-xl bg-primary/10 px-3 py-2.5">
            <RotateCcw size={16} color={colors.primary} />
            <Text className="ml-2 flex-1 text-xs font-semibold text-primary">Refund issued (simulated)</Text>
          </View>
        ) : null}

        {isCancellable(order.status) ? (
          <View className="mb-4">
            <Button
              title="Cancel order"
              variant="outline"
              loading={cancelMutation.isPending}
              onPress={confirmCancel}
              accessibilityLabel="Cancel this order"
            />
            {cancelMutation.error ? (
              <Text className="mt-2 text-xs text-danger">{(cancelMutation.error as Error).message}</Text>
            ) : null}
          </View>
        ) : null}

        <Card className="mb-4 p-4">
          <Text className="mb-2 text-sm font-bold text-ink">{order.restaurantName}</Text>
          {restaurant?.phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${restaurant.phone!.replace(/\s+/g, "")}`)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${order.restaurantName}`}
              className="flex-row items-center"
            >
              <Phone size={16} color={colors.primary} />
              <Text className="ml-2 text-sm font-semibold text-primary">{restaurant.phone}</Text>
            </Pressable>
          ) : (
            <Text className="text-xs text-muted">Contact number unavailable</Text>
          )}
        </Card>

        <Pressable
          onPress={() => router.push("/profile/help")}
          accessibilityRole="button"
          accessibilityLabel="Get help with this order"
          className="flex-row items-center justify-center rounded-xl border border-border px-3 py-3"
        >
          <HelpCircle size={16} color={colors.ink} />
          <Text className="ml-2 text-sm font-semibold text-ink">Need help with this order?</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
