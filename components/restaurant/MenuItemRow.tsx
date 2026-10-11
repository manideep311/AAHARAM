import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { router } from "expo-router";
import { MenuItem, VegFlag } from "../../types/domain";
import { RatingPill } from "../ui/RatingPill";
import { ImageWithFallback } from "../ui/ImageWithFallback";
import { QuantityStepper } from "../ui/QuantityStepper";
import { formatCurrency } from "../../lib/formatting/currency";
import { useCartStore } from "../../store/cart-store";
import { colors } from "../../constants/theme";

// Mirrors the veg/non-veg indicator used in components/home/FoodCard.tsx: a small
// outlined shape (not an emoji) colored with the shared success/danger tokens.
function VegIndicator({ vegFlag }: { vegFlag: VegFlag }) {
  if (vegFlag === "veg") {
    return <View style={{ width: 11, height: 11, borderWidth: 1.5, borderColor: colors.success }} />;
  }
  if (vegFlag === "unknown") {
    return null;
  }
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Polygon points="6,1 11,10.5 1,10.5" fill="none" stroke={colors.danger} strokeWidth={1.3} />
    </Svg>
  );
}

function hasNoCustomization(customization: { optionSelections: Record<string, string>; addOnIds: string[] }): boolean {
  return Object.keys(customization.optionSelections).length === 0 && customization.addOnIds.length === 0;
}

export function MenuItemRow({ item, restaurantIsOpen }: { item: MenuItem; restaurantIsOpen: boolean }) {
  const lines = useCartStore((s) => s.lines);
  const addItem = useCartStore((s) => s.addItem);
  const replaceCartForNewRestaurant = useCartStore((s) => s.replaceCartForNewRestaurant);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const hasRequiredOptions = item.optionGroups.some((g) => g.required);

  const existingLine = !hasRequiredOptions
    ? lines.find((l) => l.menuItemId === item.id && hasNoCustomization(l.customization))
    : undefined;
  const quantity = existingLine?.quantity ?? 0;

  function onRowPress() {
    router.push(`/food/${item.id}`);
  }

  function addWithConflictCheck(addQuantity: number) {
    const result = addItem(item, { optionSelections: {}, addOnIds: [] }, addQuantity);
    if (result.status === "different-restaurant") {
      Alert.alert(
        "Start a new cart?",
        "Your cart has items from a different restaurant. Adding this item will clear your current cart and start a new one.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start New Cart",
            style: "destructive",
            onPress: () => replaceCartForNewRestaurant(item, { optionSelections: {}, addOnIds: [] }, addQuantity),
          },
        ]
      );
    }
  }

  function onAddPress() {
    if (hasRequiredOptions) {
      router.push(`/food/${item.id}`);
    } else {
      addWithConflictCheck(1);
    }
  }

  function onIncrement() {
    if (existingLine) {
      updateQuantity(existingLine.lineId, existingLine.quantity + 1);
    } else {
      addWithConflictCheck(1);
    }
  }

  function onDecrement() {
    if (existingLine) {
      updateQuantity(existingLine.lineId, existingLine.quantity - 1);
    }
  }

  function renderAddControl() {
    if (!restaurantIsOpen) {
      return <Text className="text-xs font-semibold text-muted">Unavailable</Text>;
    }
    if (!item.isAvailable) {
      return (
        <View className="items-center">
          <View className="rounded-xl border border-border bg-border px-4 py-1.5">
            <Text className="text-sm font-bold text-muted">ADD</Text>
          </View>
          <Text className="mt-1 text-center text-[10px] font-medium text-danger" style={{ maxWidth: 92 }}>
            Currently unavailable
          </Text>
        </View>
      );
    }
    if (quantity > 0) {
      return <QuantityStepper quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />;
    }
    return (
      <Pressable
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.name} to cart`}
        className="rounded-xl border border-primary bg-card px-4 py-1.5 active:bg-primary/10"
      >
        <Text className="text-sm font-bold text-primary">ADD</Text>
      </Pressable>
    );
  }

  const isDimmed = restaurantIsOpen && !item.isAvailable;

  return (
    <Pressable
      onPress={onRowPress}
      accessibilityRole="button"
      className="flex-row border-b border-border px-4 py-4"
    >
      <View className="flex-1 pr-3">
        <VegIndicator vegFlag={item.vegFlag} />
        <Text numberOfLines={1} className="mt-1 text-base font-semibold text-ink">
          {item.name}
        </Text>
        {item.rating ? (
          <View className="mt-1">
            <RatingPill rating={item.rating} />
          </View>
        ) : null}
        <Text numberOfLines={2} className="mt-1 text-sm text-muted">
          {item.description}
        </Text>
        <Text className="mt-1.5 text-sm font-bold text-ink">{formatCurrency(item.basePrice)}</Text>
      </View>
      <View style={{ width: 110 }}>
        <View style={{ width: 110, height: 90, borderRadius: 12, overflow: "hidden", opacity: isDimmed ? 0.5 : 1 }}>
          <ImageWithFallback uri={item.imageUrl} style={{ width: "100%", height: "100%" }} />
        </View>
        <View className="mt-2 items-center">{renderAddControl()}</View>
      </View>
    </Pressable>
  );
}
