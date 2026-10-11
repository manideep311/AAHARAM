import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { router } from "expo-router";
import { MenuItem, VegFlag } from "../../types/domain";
import { Card } from "../ui/Card";
import { ImageWithFallback } from "../ui/ImageWithFallback";
import { RatingPill } from "../ui/RatingPill";
import { formatCurrency } from "../../lib/formatting/currency";
import { useCartStore } from "../../store/cart-store";
import { colors } from "../../constants/theme";

const CARD_WIDTH = 150;

function VegIndicator({ vegFlag }: { vegFlag: VegFlag }) {
  if (vegFlag === "veg") {
    return <View style={{ width: 11, height: 11, borderWidth: 1.5, borderColor: colors.success }} />;
  }
  if (vegFlag === "unknown") {
    return null;
  }
  // non-veg / egg: outlined triangle (FSSAI-style shape distinction), colored with the
  // existing "danger" design token rather than an invented hex value.
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Polygon points="6,1 11,10.5 1,10.5" fill="none" stroke={colors.danger} strokeWidth={1.3} />
    </Svg>
  );
}

export function FoodCard({ item }: { item: MenuItem }) {
  const addItem = useCartStore((s) => s.addItem);
  const replaceCartForNewRestaurant = useCartStore((s) => s.replaceCartForNewRestaurant);

  function onCardPress() {
    router.push(`/food/${item.id}`);
  }

  function onAddPress() {
    const hasRequiredOptions = item.optionGroups.some((g) => g.required);
    if (hasRequiredOptions) {
      router.push(`/food/${item.id}`);
      return;
    }
    const result = addItem(item, { optionSelections: {}, addOnIds: [] }, 1);
    if (result.status === "different-restaurant") {
      Alert.alert(
        "Start a new cart?",
        "Your cart has items from a different restaurant. Adding this item will clear your current cart and start a new one.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start New Cart",
            style: "destructive",
            onPress: () => replaceCartForNewRestaurant(item, { optionSelections: {}, addOnIds: [] }, 1),
          },
        ]
      );
    }
  }

  return (
    <Pressable onPress={onCardPress} accessibilityRole="button" style={{ width: CARD_WIDTH }}>
      <Card className="overflow-hidden">
        <View style={{ aspectRatio: 1 }}>
          <ImageWithFallback uri={item.imageUrl} style={{ width: "100%", height: "100%" }} />
          {!item.isAvailable ? (
            <View className="absolute inset-0 bg-black/40 items-center justify-center">
              <Text className="text-white text-xs font-semibold">Unavailable</Text>
            </View>
          ) : null}
        </View>
        <View className="p-2.5">
          <VegIndicator vegFlag={item.vegFlag} />
          <Text className="text-sm font-semibold text-ink mt-1" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-sm font-bold text-ink mt-0.5">{formatCurrency(item.basePrice)}</Text>
          {item.rating ? <View className="mt-1">
            <RatingPill rating={item.rating} />
          </View> : null}
          <Pressable
            onPress={onAddPress}
            disabled={!item.isAvailable}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
            className={`mt-2 rounded-xl py-1.5 items-center ${item.isAvailable ? "bg-primary active:bg-primary-deep" : "bg-border"}`}
          >
            <Text className={`text-xs font-bold ${item.isAvailable ? "text-white" : "text-muted"}`}>ADD</Text>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}
