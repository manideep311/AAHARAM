import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import {
  UtensilsCrossed,
  Pizza,
  Sandwich,
  Soup,
  IceCreamCone,
  Salad,
  Flame,
  Coffee,
  LucideIcon,
} from "lucide-react-native";
import { colors } from "../../constants/theme";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Biryani: Soup,
  Pizza: Pizza,
  Burgers: Sandwich,
  "South Indian": UtensilsCrossed,
  "North Indian": UtensilsCrossed,
  Chinese: Soup,
  Desserts: IceCreamCone,
  Healthy: Salad,
  "Street Food": Flame,
  Beverages: Coffee,
};

export function CategoryCard({ name }: { name: string }) {
  const Icon = CATEGORY_ICONS[name] ?? UtensilsCrossed;

  function onPress() {
    router.push(`/search?cuisine=${encodeURIComponent(name)}`);
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ width: 72 }}>
      <View className="bg-primary/10 rounded-2xl p-4 mb-1.5 items-center justify-center">
        <Icon size={24} color={colors.primary} />
      </View>
      <Text className="text-xs font-medium text-ink text-center" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}
