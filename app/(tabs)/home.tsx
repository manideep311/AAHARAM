import React, { useEffect, useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, Search, CircleAlert, Sparkles, ShoppingCart } from "lucide-react-native";
import { getRestaurants, getAllMenuItems } from "../../services/restaurants";
import { getOrders } from "../../services/orders";
import { getOffers } from "../../services/offers";
import { filterRestaurants } from "../../features/search/filters";
import { getRecommendations } from "../../features/recommendations/recommend";
import { useLocationStore } from "../../store/location-store";
import { useAuthStore } from "../../store/auth-store";
import { useNotificationsStore } from "../../store/notifications-store";
import { useFavoritesStore } from "../../store/favorites-store";
import { usePreferencesStore } from "../../store/preferences-store";
import { useCartStore } from "../../store/cart-store";
import { ASSISTANT_NAME } from "../../constants/brand";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { HorizontalCarousel } from "../../components/home/HorizontalCarousel";
import { RestaurantCard } from "../../components/home/RestaurantCard";
import { FoodCard } from "../../components/home/FoodCard";
import { CategoryCard } from "../../components/home/CategoryCard";
import { Offer } from "../../types/domain";
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

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <View style={{ width: 220 }} className="bg-primary rounded-2xl p-4 justify-between">
      <Text className="text-white font-bold text-base">{offer.title}</Text>
      <Text className="text-white/90 text-xs mt-1" numberOfLines={2}>
        {offer.description}
      </Text>
      {offer.couponCode ? (
        <View className="bg-white/20 rounded-full px-2.5 py-1 self-start mt-2">
          <Text className="text-white text-xs font-semibold">{offer.couponCode}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const locationLabel = useLocationStore((s) => s.label);
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const cartCount = useCartStore((s) => s.lines.length);
  const favoritesLoaded = useFavoritesStore((s) => s.loaded);
  const loadFavorites = useFavoritesStore((s) => s.load);
  const favoriteRestaurantIds = useFavoritesStore((s) => s.restaurantIds);
  const preferences = usePreferencesStore((s) => s.preferences);

  useEffect(() => {
    if (!favoritesLoaded) loadFavorites();
  }, [favoritesLoaded, loadFavorites]);

  const {
    data: restaurants,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["restaurants"],
    queryFn: getRestaurants,
  });

  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    enabled: !!user && !user.isGuest,
  });

  const popularNearYou = useMemo(
    () => (restaurants ? [...restaurants].sort((a, b) => b.ratingCount - a.ratingCount) : []),
    [restaurants]
  );
  const topRated = useMemo(
    () => (restaurants ? filterRestaurants(restaurants, { sortBy: "rating" }) : []),
    [restaurants]
  );
  const budgetFriendly = useMemo(
    () => (restaurants ? restaurants.filter((r) => r.priceRange === 1) : []),
    [restaurants]
  );
  const quickDelivery = useMemo(
    () => (restaurants ? restaurants.filter((r) => r.etaMinutes <= 30) : []),
    [restaurants]
  );
  const recommendationGroups = useMemo(
    () =>
      restaurants
        ? getRecommendations({
            orders: orders ?? [],
            favoriteRestaurantIds,
            preferences,
            restaurants,
          })
        : [],
    [restaurants, orders, favoriteRestaurantIds, preferences]
  );
  const { data: allMenuItems } = useQuery({ queryKey: ["menu-items"], queryFn: getAllMenuItems });
  const { data: offers } = useQuery({ queryKey: ["offers"], queryFn: getOffers });
  const trendingDishes = useMemo(() => (allMenuItems ?? []).filter((i) => i.popular), [allMenuItems]);

  function renderHeader() {
    return (
      <View className="pb-6">
        <View className="flex-row items-center justify-between px-4 pt-3 pb-3">
          <Pressable onPress={() => router.push("/auth/location-select")} className="flex-1 pr-3" accessibilityRole="button">
            <Text className="text-xs text-muted">Deliver to</Text>
            <Text className="text-base font-bold text-ink" numberOfLines={1}>
              {locationLabel ?? "Select location"}
            </Text>
          </Pressable>
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.push("/assistant")}
              className="p-2 mr-1"
              accessibilityRole="button"
              accessibilityLabel={`Open ${ASSISTANT_NAME}, your food assistant`}
              hitSlop={8}
            >
              <Sparkles size={22} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/notifications")}
              className="p-2 mr-1"
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={8}
            >
              <Bell size={22} color={colors.ink} />
              {unreadCount > 0 ? (
                <View className="absolute top-0 right-0 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5">
                  <Text className="text-xs font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push("/cart")}
              className="p-2 mr-1"
              accessibilityRole="button"
              accessibilityLabel="Cart"
              hitSlop={8}
            >
              <ShoppingCart size={22} color={colors.ink} />
              {cartCount > 0 ? (
                <View className="absolute top-0 right-0 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5">
                  <Text className="text-xs font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={8}
            >
              <View className="bg-primary rounded-full w-9 h-9 items-center justify-center">
                <Text className="text-white font-bold">{(user?.name ?? "G").charAt(0).toUpperCase()}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <Text className="text-xl font-bold text-ink px-4 mb-3">
          Hey {user?.name ? user.name.split(" ")[0] : "there"}, hungry?
        </Text>

        <Pressable
          onPress={() => router.push("/search")}
          accessibilityRole="button"
          className="mx-4 mb-5 flex-row items-center bg-card border border-border rounded-2xl px-4 py-3"
        >
          <Search size={18} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">Search biryani, pizza, restaurants...</Text>
        </Pressable>

        <HorizontalCarousel
          data={CUISINE_CATEGORIES}
          keyExtractor={(name) => name}
          renderItem={({ item }) => <CategoryCard name={item} />}
        />

        {isError ? (
          <View className="mt-6">
            <EmptyState
              icon={CircleAlert}
              title="Couldn't load restaurants"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => refetch()}
            />
          </View>
        ) : isLoading ? (
          <View className="px-4 mt-6">
            <Skeleton width="100%" height={20} radius={6} />
            <View className="h-3" />
            <View className="flex-row">
              <Skeleton width={260} height={180} />
              <View className="w-3" />
              <Skeleton width={260} height={180} />
            </View>
          </View>
        ) : (
          <>
            <SectionHeader title="Special Offers" />
            <HorizontalCarousel
              data={offers ?? []}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => <OfferCard offer={item} />}
            />

            <SectionHeader title="Popular Near You" />
            <HorizontalCarousel
              data={popularNearYou}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => <RestaurantCard restaurant={item} />}
            />

            <SectionHeader title="Trending Dishes" />
            <HorizontalCarousel
              data={trendingDishes}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <FoodCard item={item} />}
            />

            <SectionHeader title="Top Rated" />
            <HorizontalCarousel
              data={topRated}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => <RestaurantCard restaurant={item} />}
            />

            <SectionHeader title="Budget Friendly" />
            <HorizontalCarousel
              data={budgetFriendly}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => <RestaurantCard restaurant={item} />}
            />

            <SectionHeader title="Quick Delivery" />
            <HorizontalCarousel
              data={quickDelivery}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => <RestaurantCard restaurant={item} />}
            />

            {recommendationGroups.map((group) => (
              <View key={group.reason}>
                <SectionHeader title={group.reason} />
                <HorizontalCarousel
                  data={group.restaurants}
                  keyExtractor={(r) => r.id}
                  renderItem={({ item }) => <RestaurantCard restaurant={item} />}
                />
              </View>
            ))}
          </>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <FlatList data={[]} keyExtractor={() => "unused"} renderItem={() => null} ListHeaderComponent={renderHeader} />
    </View>
  );
}
