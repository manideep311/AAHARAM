import React, { useMemo } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ReceiptText, AlertTriangle } from "lucide-react-native";
import { getOrders } from "../../services/orders";
import { OrderCard } from "../../components/orders/OrderCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { isTerminalStatus } from "../../features/orders/status";
import { Order } from "../../types/domain";
import { colors } from "../../constants/theme";

type Row = { kind: "section"; key: string; title: string } | { kind: "order"; key: string; order: Order };

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();

  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const orders = ordersQuery.data ?? [];

  const { active, previous } = useMemo(() => {
    const active: Order[] = [];
    const previous: Order[] = [];
    for (const order of orders) {
      (isTerminalStatus(order.status) ? previous : active).push(order);
    }
    return { active, previous };
  }, [orders]);

  const rows: Row[] = useMemo(() => {
    const result: Row[] = [];
    if (active.length > 0) {
      result.push({ kind: "section", key: "section-active", title: "Active Orders" });
      for (const order of active) result.push({ kind: "order", key: `active-${order.id}`, order });
    }
    if (previous.length > 0) {
      result.push({ kind: "section", key: "section-previous", title: "Previous Orders" });
      for (const order of previous) result.push({ kind: "order", key: `previous-${order.id}`, order });
    }
    return result;
  }, [active, previous]);

  if (ordersQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Text className="px-4 pt-3 pb-2 text-xl font-bold text-ink">Your Orders</Text>
        <View className="px-4">
          <Skeleton width="100%" height={160} />
          <View className="mt-3">
            <Skeleton width="100%" height={160} />
          </View>
        </View>
      </View>
    );
  }

  if (ordersQuery.isError) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Text className="px-4 pt-3 pb-2 text-xl font-bold text-ink">Your Orders</Text>
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your orders"
          description="Please try again."
          actionLabel="Retry"
          onAction={() => ordersQuery.refetch()}
        />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Text className="px-4 pt-3 pb-2 text-xl font-bold text-ink">Your Orders</Text>
        <EmptyState
          icon={ReceiptText}
          title="No orders yet"
          description="Once you place an order, it'll show up here."
          actionLabel="Browse Restaurants"
          onAction={() => router.push("/(tabs)/home")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 16 }}
        refreshControl={
          <RefreshControl refreshing={ordersQuery.isRefetching} onRefresh={() => ordersQuery.refetch()} tintColor={colors.primary} />
        }
        ListHeaderComponent={<Text className="pt-3 pb-2 text-xl font-bold text-ink">Your Orders</Text>}
        renderItem={({ item }) =>
          item.kind === "section" ? (
            <Text className="mb-2 mt-3 text-sm font-bold text-muted">{item.title}</Text>
          ) : (
            <OrderCard order={item.order} />
          )
        }
      />
    </View>
  );
}
