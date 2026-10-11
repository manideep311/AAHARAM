import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, AlertTriangle, MapPin, Clock, Banknote } from "lucide-react-native";
import { getOrderById } from "../../services/orders";
import { getAddresses } from "../../services/addresses";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatCurrency } from "../../lib/formatting/currency";
import { formatOrderDate } from "../../lib/formatting/datetime";
import { BRAND_NAME } from "../../constants/brand";
import { colors } from "../../constants/theme";

export default function OrderConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId as string),
    enabled: !!orderId,
  });
  const order = orderQuery.data;

  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const address = addressesQuery.data?.find((a) => a.id === order?.addressId);

  if (!orderId) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <EmptyState icon={AlertTriangle} title="Order not found" />
      </View>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top + 24 }}>
        <View className="px-4">
          <Skeleton width="100%" height={140} />
          <View className="mt-3">
            <Skeleton width="100%" height={200} />
          </View>
        </View>
      </View>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your order"
          description="Please check your orders list."
          actionLabel="Go to Orders"
          onAction={() => router.replace("/(tabs)/orders")}
        />
      </View>
    );
  }

  const paymentStatusText = order.paymentMethod === "cod" ? "Pay on delivery" : "Payment successful";
  const paymentStatusCaption =
    order.paymentMethod === "cod" ? null : "Simulated payment — no money moved";

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center mb-6">
          <View className="bg-success/10 rounded-full p-4 mb-3">
            <CheckCircle2 size={48} color={colors.success} />
          </View>
          <Text className="text-xl font-bold text-ink text-center">Order Confirmed!</Text>
          <Text className="mt-1 text-sm text-muted text-center">
            Thanks for ordering with {BRAND_NAME}. {order.restaurantName} is getting started on it.
          </Text>
        </View>

        <Card className="mb-4 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-ink">Order #{order.id}</Text>
            <Text className="text-xs text-muted">{formatOrderDate(order.placedAt)}</Text>
          </View>
          <View className="my-2 h-px bg-border" />
          {order.items.map((item, i) => (
            <View key={`${item.menuItemId}-${i}`} className="flex-row items-center justify-between py-1">
              <Text className="flex-1 pr-3 text-sm text-ink" numberOfLines={1}>
                {item.quantity} × {item.name}
              </Text>
              <Text className="text-sm font-semibold text-ink">{formatCurrency(item.unitPrice * item.quantity)}</Text>
            </View>
          ))}
          <View className="my-2 h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-ink">Total</Text>
            <Text className="text-sm font-bold text-ink">{formatCurrency(order.total)}</Text>
          </View>
        </Card>

        <Card className="mb-4 p-4">
          <View className="flex-row items-center">
            <Banknote size={18} color={colors.primary} />
            <Text className="ml-2 text-sm font-semibold text-ink">{paymentStatusText}</Text>
          </View>
          {paymentStatusCaption ? (
            <Text className="ml-7 mt-0.5 text-xs text-muted">{paymentStatusCaption}</Text>
          ) : null}
        </Card>

        <Card className="mb-4 p-4">
          <View className="flex-row items-start">
            <MapPin size={18} color={colors.primary} />
            <View className="ml-2 flex-1">
              <Text className="text-sm font-bold text-ink">Delivering to</Text>
              {address ? (
                <Text className="mt-1 text-sm text-muted">
                  {address.line1}, {address.area}, {address.city}, {address.state} {address.postalCode}
                </Text>
              ) : (
                <Text className="mt-1 text-sm text-muted">Address on file</Text>
              )}
            </View>
          </View>
        </Card>

        {order.etaMinutes ? (
          <Card className="mb-6 p-4">
            <View className="flex-row items-center">
              <Clock size={18} color={colors.primary} />
              <Text className="ml-2 text-sm font-semibold text-ink">
                Estimated arrival in ~{order.etaMinutes} mins
              </Text>
            </View>
          </Card>
        ) : null}

        <Button
          title="Track Your Order"
          size="lg"
          accessibilityLabel="View order tracking"
          onPress={() => router.replace(`/tracking/${order.id}`)}
        />
      </ScrollView>
    </View>
  );
}
