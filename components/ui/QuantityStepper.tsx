import React from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Minus } from "lucide-react-native";

export function QuantityStepper({ quantity, onIncrement, onDecrement, min = 0 }: { quantity: number; onIncrement: () => void; onDecrement: () => void; min?: number }) {
  return (
    <View className="flex-row items-center bg-primary rounded-full">
      <Pressable accessibilityLabel="Decrease quantity" onPress={onDecrement} disabled={quantity <= min} className="p-2.5">
        <Minus size={16} color="#fff" />
      </Pressable>
      <Text className="text-white font-semibold w-6 text-center">{quantity}</Text>
      <Pressable accessibilityLabel="Increase quantity" onPress={onIncrement} className="p-2.5">
        <Plus size={16} color="#fff" />
      </Pressable>
    </View>
  );
}
