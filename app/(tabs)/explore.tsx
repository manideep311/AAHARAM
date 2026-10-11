import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Search, CircleAlert, SlidersHorizontal } from "lucide-react-native";
import { getRestaurants } from "../../services/restaurants";
import { SEED_MENU_ITEMS } from "../../data/seed/menu-items";
import { filterRestaurants, RestaurantFilters } from "../../features/search/filters";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Badge } from "../../components/ui/Badge";
import { HorizontalCarousel } from "../../components/home/HorizontalCarousel";
import { RestaurantCard } from "../../components/home/RestaurantCard";
import { FoodCard } from "../../components/home/FoodCard";
import { CategoryCard } from "../../components/home/CategoryCard";
import { Restaurant } from "../../types/domain";
import { colors } from "../../constants/theme";

const CUISINE_CATEGORIES = [
  "Biryani",
  "Pizza",
  "Burgers",
  "South Indian",
  "North Indian",
  "Chinese",
  "Desserts",
  "Healthy",
  "Street Food",
  "Beverages",
];

type SortOption = "relevance" | "rating" | "price" | "eta";

const SORT_CHIPS: { key: SortOption; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "rating", label: "Rating" },
  { key: "price", label: "Price" },
  { key: "eta", label: "Delivery Time" },
];

// A restaurant counts as "pure veg" when none of its menu items are flagged
// non-veg or egg. Restaurant-level veg-only filtering isn't a field on
// Restaurant itself, so it's derived from menu items here rather than inside
// the shared filterRestaurants() helper (see features/search/filters.ts).
function isPureVegRestaurant(restaurantId: string): boolean {
  return !SEED_MENU_ITEMS.some(
    (item) => item.restaurantId === restaurantId && (item.vegFlag === "non-veg" || item.vegFlag === "egg")
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} className="mr-2 mb-2">
      <Badge label={label} tone={active ? "primary" : "muted"} />
    </Pressable>
  );
}

export default function Explore() {
  const insets = useSafeAreaInsets();
  const [vegOnly, setVegOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");

  const {
    data: restaurants,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["restaurants"],
    queryFn: getRestaurants,
  });

  const popularDishes = useMemo(
    () =>
      [...SEED_MENU_ITEMS]
        .filter((i) => i.isAvailable)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 10),
    []
  );

  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return [];
    const filters: RestaurantFilters = { sortBy };
    let result = filterRestaurants(restaurants, filters);
    if (vegOnly) result = result.filter((r) => isPureVegRestaurant(r.id));
    return result;
  }, [restaurants, sortBy, vegOnly]);

  const hasActiveFilters = vegOnly || sortBy !== "relevance";

  function clearFilters() {
    setVegOnly(false);
    setSortBy("relevance");
  }

  function renderHeader() {
    return (
      <View className="pb-2">
        <View className="px-4 pt-3 pb-1">
          <Text className="text-xl font-bold text-ink mb-3">Explore</Text>
          <Pressable
            onPress={() => router.push("/search")}
            accessibilityRole="button"
            className="flex-row items-center bg-card border border-border rounded-2xl px-4 py-3"
          >
            <Search size={18} color={colors.muted} />
            <Text className="text-muted text-sm ml-2">Search biryani, pizza, restaurants...</Text>
          </Pressable>
        </View>

        <SectionHeader title="Categories" />
        <View className="flex-row flex-wrap px-4">
          {CUISINE_CATEGORIES.map((name) => (
            <View key={name} style={{ width: "25%" }} className="items-center mb-4">
              <CategoryCard name={name} />
            </View>
          ))}
        </View>

        <SectionHeader title="Popular Dishes" />
        <HorizontalCarousel
          data={popularDishes}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <FoodCard item={item} />}
        />

        <View className="px-4 mt-6 mb-1 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <SlidersHorizontal size={16} color={colors.ink} />
            <Text className="text-base font-bold text-ink ml-2">All Restaurants</Text>
          </View>
          {hasActiveFilters ? (
            <Pressable onPress={clearFilters} accessibilityRole="button">
              <Text className="text-sm font-semibold text-primary">Clear Filters</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="px-4 mt-2 mb-3">
          <View className="flex-row flex-wrap">
            <FilterChip label="Veg Only" active={vegOnly} onPress={() => setVegOnly((v) => !v)} />
          </View>
          <View className="flex-row flex-wrap mt-1">
            {SORT_CHIPS.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                active={sortBy === chip.key}
                onPress={() => setSortBy(chip.key)}
              />
            ))}
          </View>
        </View>

        {isError ? (
          <View className="mt-4">
            <EmptyState
              icon={CircleAlert}
              title="Couldn't load restaurants"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => refetch()}
            />
          </View>
        ) : isLoading ? (
          <View className="px-4 mt-2">
            <Skeleton width="100%" height={180} radius={16} />
            <View className="h-3" />
            <Skeleton width="100%" height={180} radius={16} />
          </View>
        ) : null}
      </View>
    );
  }

  function renderEmpty() {
    if (isLoading || isError) return null;
    return (
      <EmptyState
        icon={Search}
        title="No restaurants match your filters"
        description="Try adjusting or clearing your filters."
        actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
        onAction={hasActiveFilters ? clearFilters : undefined}
      />
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <FlatList<Restaurant>
        data={isLoading || isError ? [] : filteredRestaurants}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View className="px-4 mb-4 items-center">
            <RestaurantCard restaurant={item} />
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
