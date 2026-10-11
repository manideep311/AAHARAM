import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

export interface MenuCategoryChip {
  id: string;
  name: string;
}

export function MenuCategoryBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: MenuCategoryChip[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <View className="bg-bg border-b border-border">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
      >
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <Pressable
              key={category.id}
              onPress={() => onSelect(category.id)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${category.name}`}
              className={`mr-2 px-4 py-2 rounded-full border ${
                active ? "bg-primary border-primary" : "bg-card border-border"
              }`}
            >
              <Text className={`text-sm font-semibold ${active ? "text-white" : "text-ink"}`}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
