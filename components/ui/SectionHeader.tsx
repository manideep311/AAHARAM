import React from "react";
import { View, Text, Pressable } from "react-native";

export function SectionHeader({ title, actionLabel, onActionPress }: { title: string; actionLabel?: string; onActionPress?: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-4 mb-3 mt-5">
      <Text className="text-lg font-bold text-ink">{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress}>
          <Text className="text-sm font-semibold text-primary">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
