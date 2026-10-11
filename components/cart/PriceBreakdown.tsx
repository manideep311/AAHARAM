import React from "react";
import { View, Text } from "react-native";
import { Card } from "../ui/Card";
import { CartTotals } from "../../lib/pricing/calculate";
import { formatCurrency } from "../../lib/formatting/currency";

interface PriceBreakdownProps {
  totals: CartTotals;
  /** Restaurant's normal delivery fee, shown struck through when totals.freeDelivery is true.
   *  Optional because CartTotals alone already zeroes the fee when free delivery applies. */
  originalDeliveryFee?: number;
}

export function PriceBreakdown({ totals, originalDeliveryFee }: PriceBreakdownProps) {
  return (
    <Card className="p-4">
      <Text className="mb-2 text-base font-bold text-ink">Bill Details</Text>

      <Row label="Item Subtotal" value={formatCurrency(totals.subtotal)} />

      {totals.discount > 0 ? (
        <Row label="Discount" value={`-${formatCurrency(totals.discount)}`} valueClassName="text-success" />
      ) : null}

      <View className="flex-row items-center justify-between py-1">
        <Text className="text-sm text-muted">Delivery Fee</Text>
        {totals.freeDelivery ? (
          <View className="flex-row items-center">
            <Text className="mr-2 text-sm text-muted line-through">
              {formatCurrency(originalDeliveryFee ?? totals.deliveryFee)}
            </Text>
            <Text className="text-sm font-semibold text-success">FREE</Text>
          </View>
        ) : (
          <Text className="text-sm text-ink">{formatCurrency(totals.deliveryFee)}</Text>
        )}
      </View>

      <Row label="Taxes" value={formatCurrency(totals.tax)} />

      <View className="my-2 h-px bg-border" />

      <Row label="Total" value={formatCurrency(totals.total)} bold />
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  valueClassName = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={bold ? "text-base font-bold text-ink" : "text-sm text-muted"}>{label}</Text>
      <Text className={`${bold ? "text-base font-bold text-ink" : "text-sm text-ink"} ${valueClassName}`}>{value}</Text>
    </View>
  );
}
