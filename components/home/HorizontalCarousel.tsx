import React from "react";
import { FlatList, ListRenderItem, View } from "react-native";

interface HorizontalCarouselProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  contentContainerStyle?: object;
}

export function HorizontalCarousel<T>({ data, renderItem, keyExtractor, contentContainerStyle }: HorizontalCarouselProps<T>) {
  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      contentContainerStyle={{ paddingHorizontal: 16, ...contentContainerStyle }}
    />
  );
}
