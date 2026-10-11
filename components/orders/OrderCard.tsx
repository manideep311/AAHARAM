import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Order } from "../../types/domain";
import { formatCurrency } from "../../lib/formatting/currency";
import { formatOrderDate } from "../../lib/formatting/datetime";
import { ORDER_STATUS_LABELS, orderStatusTone, orderStatusIcon, isTerminalStatus } from "../../features/orders/status";
import { useReorderFlow } from "../../features/orders/useReorderFlow";
import { colors } from "../../constants/theme";

function itemsPreview(order: Order): string {
  const first = order.items[0];
  if (!first) return "No items";
  const firstText = `${first.quantity} × ${first.name}`;
  const extraCount = order.items.length - 1;
  return extraCount > 0 ? `${firstText} + ${extraCount} more item${extraCount > 1 ? "s" : ""}` : firstText;
}

export function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(true);
  const { phase, result, startReorder, confirmPartialReorder } = useReorderFlow(order);

  const StatusIcon = orderStatusIcon(order.status);
  const trackable = !isTerminalStatus(order.status);

  return (
    <Card className="mb-3 p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {order.restaurantName}
          </Text>
          <Text className="mt-0.5 text-xs text-muted">{formatOrderDate(order.placedAt)}</Text>
        </View>
        <Badge label={ORDER_STATUS_LABELS[order.status]} tone={orderStatusTone(order.status)} icon={StatusIcon} />
      </View>

      <Text className="mt-3 text-sm text-ink" numberOfLines={2}>
        {itemsPreview(order)}
      </Text>

      <View className="mt-2 flex-row items-baseline justify-between">
        <Text className="text-xs text-muted">Total</Text>
        <Text className="text-sm font-bold text-ink">{formatCurrency(order.total)}</Text>
      </View>

      {phase === "restaurant-unavailable" ? (
        <View className="mt-3 flex-row items-start rounded-xl bg-danger/10 px-3 py-2.5">
          <AlertTriangle size={16} color={colors.danger} />
          <Text className="ml-2 flex-1 text-xs font-semibold text-danger">
            {order.restaurantName} isn't accepting orders right now. Try reordering again later.
          </Text>
        </View>
      ) : null}

      {phase === "error" ? (
        <View className="mt-3 flex-row items-start rounded-xl bg-danger/10 px-3 py-2.5">
          <AlertTriangle size={16} color={colors.danger} />
          <Text className="ml-2 flex-1 text-xs font-semibold text-danger">
            Couldn't check this order's items. Please try again.
          </Text>
        </View>
      ) : null}

      {phase === "needs-confirmation" && result ? (
        <View className="mt-3 rounded-xl border border-border px-3 py-2.5">
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Hide unavailable items" : "Show unavailable items"}
            className="flex-row items-center justify-between"
          >
            <Text className="flex-1 text-xs font-semibold text-danger">
              {result.unavailableItems.length} item{result.unavailableItems.length > 1 ? "s" : ""} can't be reordered
            </Text>
            {expanded ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
          </Pressable>

          {expanded ? (
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

      <View className="mt-3 flex-row">
        {trackable ? (
          <Pressable
            onPress={() => router.push(`/tracking/${order.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Track order"
            className="mr-3 flex-1 rounded-xl border border-primary px-3 py-2.5 items-center"
          >
            <Text className="text-sm font-semibold text-primary">Track Order</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push(`/order-details/${order.id}`)}
          accessibilityRole="button"
          accessibilityLabel="View order details"
          className="mr-3 flex-1 rounded-xl border border-border px-3 py-2.5 items-center"
        >
          <Text className="text-sm font-semibold text-ink">View Details</Text>
        </Pressable>
        <Pressable
          onPress={startReorder}
          disabled={phase === "loading"}
          accessibilityRole="button"
          accessibilityLabel="Reorder"
          className={`flex-1 flex-row items-center justify-center rounded-xl bg-primary px-3 py-2.5 ${phase === "loading" ? "opacity-60" : ""}`}
        >
          {phase === "loading" ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <RefreshCw size={14} color="#fff" />
              <Text className="ml-1.5 text-sm font-semibold text-white">Reorder</Text>
            </>
          )}
        </Pressable>
      </View>
    </Card>
  );
}
