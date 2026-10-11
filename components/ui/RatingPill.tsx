import React from "react";
import { View, Text } from "react-native";
import { Star } from "lucide-react-native";

export function RatingPill({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  return (
    <View className="flex-row items-center bg-success/10 rounded-full px-2 py-0.5 self-start">
      <Star size={12} color="#198754" fill="#198754" />
      <Text className="text-xs font-semibold text-success ml-1">{rating.toFixed(1)}</Text>
      {reviewCount ? <Text className="text-xs text-success ml-1">({reviewCount})</Text> : null}
    </View>
  );
}
