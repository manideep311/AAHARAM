import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { MenuItem, Restaurant } from "../../types/domain";
import { Card } from "../ui/Card";
import { ImageWithFallback } from "../ui/ImageWithFallback";
import { RatingPill } from "../ui/RatingPill";
import { formatCurrency } from "../../lib/formatting/currency";
import { useCartStore } from "../../store/cart-store";

const CARD_WIDTH = 168;

type ResultCardProps = { type: "restaurant"; restaurant: Restaurant } | { type: "item"; item: MenuItem };

export function ResultCard(props: ResultCardProps) {
  if (props.type === "restaurant") {
    return <RestaurantResultCard restaurant={props.restaurant} />;
  }
  return <ItemResultCard item={props.item} />;
}

function RestaurantResultCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Pressable
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
      accessibilityRole="button"
      style={{ width: CARD_WIDTH }}
    >
      <Card className="overflow-hidden">
        <View style={{ aspectRatio: 16 / 9 }}>
          <ImageWithFallback uri={restaurant.coverImageUrl} style={{ width: "100%", height: "100%" }} />
        </View>
        <View className="p-2.5">
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
            {restaurant.cuisines.join(" · ")}
          </Text>
          <View className="flex-row items-center justify-between mt-1.5">
            <RatingPill rating={restaurant.rating} />
            <Text className="text-xs text-muted">{restaurant.etaMinutes} min</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function ItemResultCard({ item }: { item: MenuItem }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  function onCardPress() {
    router.push(`/food/${item.id}`);
  }

  function onAddPress() {
    const hasRequiredOptions = item.optionGroups.some((g) => g.required);
    if (hasRequiredOptions) {
      // Never add to cart without the explicit per-item confirmation this item requires.
      router.push(`/food/${item.id}`);
      return;
    }
    addItem(item, { optionSelections: {}, addOnIds: [] }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
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
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-sm font-bold text-ink mt-0.5">{formatCurrency(item.basePrice)}</Text>
          {item.rating ? (
            <View className="mt-1">
              <RatingPill rating={item.rating} />
            </View>
          ) : null}
          <Pressable
            onPress={onAddPress}
            disabled={!item.isAvailable}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
            className={`mt-2 rounded-xl py-1.5 items-center ${
              !item.isAvailable ? "bg-border" : added ? "bg-success" : "bg-primary active:bg-primary-deep"
            }`}
          >
            <Text className={`text-xs font-bold ${!item.isAvailable ? "text-muted" : "text-white"}`}>
              {added ? "Added" : "Add to Cart"}
            </Text>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}
