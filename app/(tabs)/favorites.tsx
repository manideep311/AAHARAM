import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Heart, UtensilsCrossed } from "lucide-react-native";
import { useFavoritesStore } from "../../store/favorites-store";
import { useAuthStore } from "../../store/auth-store";
import { useQuery } from "@tanstack/react-query";
import { getRestaurants, getAllMenuItems } from "../../services/restaurants";
import { EmptyState } from "../../components/ui/EmptyState";
import { RestaurantCard } from "../../components/home/RestaurantCard";
import { FoodCard } from "../../components/home/FoodCard";
import { Restaurant, MenuItem } from "../../types/domain";

type Segment = "restaurants" | "dishes";

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-1 items-center py-2.5 rounded-xl ${active ? "bg-primary" : "bg-transparent"}`}
    >
      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-muted"}`}>{label}</Text>
    </Pressable>
  );
}

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>("restaurants");
  const user = useAuthStore((s) => s.user);

  const loaded = useFavoritesStore((s) => s.loaded);
  const load = useFavoritesStore((s) => s.load);
  const restaurantIds = useFavoritesStore((s) => s.restaurantIds);
  const menuItemIds = useFavoritesStore((s) => s.menuItemIds);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const { data: restaurants } = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants });
  const { data: allMenuItems } = useQuery({ queryKey: ["menu-items"], queryFn: getAllMenuItems });

  const favoriteRestaurants = useMemo(
    () => (restaurants ?? []).filter((r) => restaurantIds.includes(r.id)),
    [restaurants, restaurantIds]
  );
  const favoriteDishes = useMemo(
    () => (allMenuItems ?? []).filter((i) => menuItemIds.includes(i.id)),
    [allMenuItems, menuItemIds]
  );

  function browse() {
    router.push("/(tabs)/explore");
  }

  if (!user || user.isGuest) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Text className="px-4 pt-3 pb-4 text-xl font-bold text-ink">Favorites</Text>
        <EmptyState
          icon={Heart}
          title="Sign in to save favorites"
          description="Tap the heart on any restaurant to keep it here."
          actionLabel="Sign in"
          onAction={() => router.push("/auth/login?returnTo=%2F(tabs)%2Ffavorites")}
        />
      </View>
    );
  }

  function renderHeader() {
    return (
      <View className="px-4 pt-3 pb-4">
        <Text className="text-xl font-bold text-ink mb-4">Favorites</Text>
        <View className="flex-row bg-border/50 rounded-xl p-1">
          <SegmentButton label="Restaurants" active={segment === "restaurants"} onPress={() => setSegment("restaurants")} />
          <SegmentButton label="Dishes" active={segment === "dishes"} onPress={() => setSegment("dishes")} />
        </View>
      </View>
    );
  }

  if (segment === "restaurants") {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <FlatList<Restaurant>
          data={favoriteRestaurants}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="px-4 mb-4 items-center">
              <RestaurantCard restaurant={item} />
            </View>
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon={Heart}
              title="No favorite restaurants yet"
              description="Tap the heart on any restaurant to save it here."
              actionLabel="Browse"
              onAction={browse}
            />
          }
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <FlatList<MenuItem>
        data={favoriteDishes}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 16, justifyContent: "space-between" }}
        renderItem={({ item }) => (
          <View className="mb-4">
            <FoodCard item={item} />
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            icon={UtensilsCrossed}
            title="No favorite dishes yet"
            description="Tap the heart on any dish to save it here."
            actionLabel="Browse"
            onAction={browse}
          />
        }
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      />
    </View>
  );
}
