import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Card } from "../ui/Card";
import { QuantityStepper } from "../ui/QuantityStepper";
import { formatCurrency } from "../../lib/formatting/currency";
import { useCartStore } from "../../store/cart-store";
import { CartLineItem as CartLineItemModel, MenuItem, SpiceLevel } from "../../types/domain";

const SPICE_LABELS: Record<SpiceLevel, string> = {
  mild: "Mild spice",
  medium: "Medium spice",
  spicy: "Spicy",
};

// Builds a one-line customization summary like "Large · Extra Paneer, Raita · Medium spice"
// from the line's stored selections and the resolved MenuItem's option/add-on labels.
function buildCustomizationSummary(line: CartLineItemModel, menuItem: MenuItem): string {
  const segments: string[] = [];

  const optionLabels = menuItem.optionGroups
    .map((group) => {
      const selectedId = line.customization.optionSelections[group.id];
      return group.options.find((o) => o.id === selectedId)?.label;
    })
    .filter((label): label is string => !!label);
  if (optionLabels.length > 0) segments.push(optionLabels.join(", "));

  const addOnLabels = line.customization.addOnIds
    .map((id) => menuItem.addOns.find((a) => a.id === id)?.name)
    .filter((name): name is string => !!name);
  if (addOnLabels.length > 0) segments.push(addOnLabels.join(", "));

  if (line.customization.spiceLevel) segments.push(SPICE_LABELS[line.customization.spiceLevel]);

  return segments.join(" · ");
}

interface CartLineItemCardProps {
  line: CartLineItemModel;
  menuItem: MenuItem | undefined;
  unavailable?: boolean;
}

export function CartLineItemCard({ line, menuItem, unavailable }: CartLineItemCardProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const name = menuItem?.name ?? "Item no longer available";
  const summary = menuItem ? buildCustomizationSummary(line, menuItem) : "";

  return (
    <Card className="mb-3 p-3">
      <View className="flex-row">
        <View className="flex-1 pr-3">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>
            {name}
          </Text>
          {summary ? (
            <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
              {summary}
            </Text>
          ) : null}
          {line.customization.specialInstructions ? (
            <Text className="mt-1 text-xs italic text-muted" numberOfLines={1}>
              Note: {line.customization.specialInstructions}
            </Text>
          ) : null}
          {unavailable ? (
            <Text className="mt-1 text-xs font-semibold text-danger">No longer available - remove it to continue</Text>
          ) : null}

          {/* Editing-in-place isn't implemented in this sub-project (Task 13's customization
              screen doesn't accept an existing line to prefill). "Edit" is just a
              remove-and-re-add entry point: it opens the item's customization sheet fresh,
              and the user adjusts quantity/options there, then removes this line manually
              if they no longer want the original. */}
          <Pressable
            onPress={() => router.push(`/food/${line.menuItemId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
            hitSlop={6}
            className="mt-1.5 self-start"
          >
            <Text className="text-xs font-semibold text-primary">Edit</Text>
          </Pressable>
        </View>

        <View className="items-end justify-between">
          <Text className="text-sm font-bold text-ink">{formatCurrency(line.unitPrice * line.quantity)}</Text>
          <QuantityStepper
            quantity={line.quantity}
            onIncrement={() => updateQuantity(line.lineId, line.quantity + 1)}
            onDecrement={() => updateQuantity(line.lineId, line.quantity - 1)}
          />
        </View>
      </View>
    </Card>
  );
}
