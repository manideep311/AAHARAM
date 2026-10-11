import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, SectionList, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Search as SearchIcon, X, Clock, AlertTriangle, UtensilsCrossed } from "lucide-react-native";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { SEED_OFFERS } from "../../data/seed/offers";
import { MenuCategoryBar, MenuCategoryChip } from "../../components/restaurant/MenuCategoryBar";
import { MenuItemRow } from "../../components/restaurant/MenuItemRow";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ImageWithFallback } from "../../components/ui/ImageWithFallback";
import { RatingPill } from "../../components/ui/RatingPill";
import { formatCurrency } from "../../lib/formatting/currency";
import { MenuItem } from "../../types/domain";
import { colors } from "../../constants/theme";

const POPULAR_SECTION_ID = "popular";

interface MenuSection {
  id: string;
  title: string;
  data: MenuItem[];
}

export default function RestaurantDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const restaurantId = params.id;

  const [searchText, setSearchText] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sectionListRef = useRef<SectionList<MenuItem, MenuSection>>(null);

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => getRestaurantById(restaurantId as string),
    enabled: !!restaurantId,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", restaurantId],
    queryFn: () => getMenuForRestaurant(restaurantId as string),
    enabled: !!restaurantId,
  });

  const restaurant = restaurantQuery.data;
  const categories = menuQuery.data?.categories ?? [];
  const allItems = menuQuery.data?.items ?? [];

  const trimmedSearch = searchText.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!trimmedSearch) return allItems;
    return allItems.filter((item) => item.name.toLowerCase().includes(trimmedSearch));
  }, [allItems, trimmedSearch]);

  const hasPopularItems = useMemo(() => allItems.some((item) => item.popular), [allItems]);

  const sections = useMemo<MenuSection[]>(() => {
    const result: MenuSection[] = [];
    if (hasPopularItems) {
      const popularItems = filteredItems.filter((item) => item.popular);
      if (popularItems.length > 0) {
        result.push({ id: POPULAR_SECTION_ID, title: "Popular", data: popularItems });
      }
    }
    for (const category of categories) {
      const items = filteredItems.filter((item) => item.categoryId === category.id);
      if (items.length > 0) {
        result.push({ id: category.id, title: category.name, data: items });
      }
    }
    return result;
  }, [categories, filteredItems, hasPopularItems]);

  const chips: MenuCategoryChip[] = useMemo(
    () => sections.map((s) => ({ id: s.id, name: s.title })),
    [sections]
  );

  // Keep the active chip valid as sections change (e.g. due to search filtering).
  useEffect(() => {
    if (sections.length === 0) {
      setActiveSectionId(null);
      return;
    }
    if (!sections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(sections[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  function onSelectCategory(id: string) {
    const sectionIndex = sections.findIndex((s) => s.id === id);
    if (sectionIndex === -1) return;
    setActiveSectionId(id);
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      viewPosition: 0,
      animated: true,
    });
  }

  const offers = restaurantId ? SEED_OFFERS.filter((o) => o.restaurantId === restaurantId) : [];

  const isLoading = restaurantQuery.isLoading || menuQuery.isLoading;
  const isError = restaurantQuery.isError || menuQuery.isError;

  function onRetry() {
    restaurantQuery.refetch();
    menuQuery.refetch();
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Skeleton width="100%" height={200} radius={0} />
        <View className="px-4 py-4">
          <Skeleton width="60%" height={22} />
          <View className="mt-2">
            <Skeleton width="40%" height={14} />
          </View>
          <View className="mt-3 flex-row">
            <Skeleton width={70} height={24} />
          </View>
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-row px-4 py-3">
            <View className="flex-1 pr-3">
              <Skeleton width="70%" height={16} />
              <View className="mt-2">
                <Skeleton width="90%" height={13} />
              </View>
              <View className="mt-2">
                <Skeleton width={60} height={14} />
              </View>
            </View>
            <Skeleton width={90} height={90} />
          </View>
        ))}
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="We couldn't load this restaurant. Please try again."
          actionLabel="Retry"
          onAction={onRetry}
        />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <EmptyState icon={AlertTriangle} title="Restaurant not found" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Fixed (sticky) top bar: back button + horizontal category chip row. This never
          scrolls away, so MenuCategoryBar is always available to jump to a section. */}
      <View className="flex-row items-center bg-bg" style={{ paddingTop: insets.top }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="pl-3 pr-1 py-2"
        >
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <MenuCategoryBar categories={chips} activeId={activeSectionId} onSelect={onSelectCategory} />
        </View>
      </View>

      <SectionList<MenuItem, MenuSection>
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <View style={{ width: "100%", aspectRatio: 16 / 9 }}>
              <ImageWithFallback uri={restaurant.coverImageUrl} style={{ width: "100%", height: "100%" }} />
            </View>

            <View className="px-4 pb-3 pt-4">
              <Text className="text-xl font-bold text-ink">{restaurant.name}</Text>
              <Text className="mt-1 text-sm text-muted" numberOfLines={1}>
                {restaurant.cuisines.join(" · ")}
              </Text>
              <View className="mt-2 flex-row items-center">
                <RatingPill rating={restaurant.rating} reviewCount={restaurant.ratingCount} />
                <Text className="ml-3 text-xs text-muted">
                  {restaurant.etaMinutes} min ·{" "}
                  {restaurant.deliveryFee === 0 ? "Free delivery" : `${formatCurrency(restaurant.deliveryFee)} delivery`}
                </Text>
              </View>
            </View>

            {!restaurant.isOpen ? (
              <View className="mx-4 mb-3 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
                <Clock size={16} color={colors.danger} />
                <Text className="ml-2 text-sm font-semibold text-danger">
                  Closed now · Opens at {restaurant.operatingHours.opensAt}
                </Text>
              </View>
            ) : null}

            {offers.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              >
                {offers.map((offer) => (
                  <View key={offer.id} className="mr-3 w-64 rounded-2xl border border-border bg-card p-3">
                    <Text className="text-sm font-bold text-primary">{offer.title}</Text>
                    <Text className="mt-0.5 text-xs text-muted" numberOfLines={2}>
                      {offer.description}
                    </Text>
                    {offer.couponCode ? (
                      <Text className="mt-1 text-xs font-semibold text-ink">Code: {offer.couponCode}</Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 py-2.5 mx-4 mb-2">
              <SearchIcon size={18} color={colors.muted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={`Search menu in ${restaurant.name}`}
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                className="flex-1 text-base text-ink ml-2"
              />
              {searchText.length > 0 ? (
                <Pressable onPress={() => setSearchText("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
                  <X size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-bg px-4 pb-2 pt-4">
            <Text className="text-base font-bold text-ink">{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => <MenuItemRow item={item} restaurantIsOpen={restaurant.isOpen} />}
        ListEmptyComponent={
          <EmptyState
            icon={UtensilsCrossed}
            title="No items found"
            description={trimmedSearch ? `No menu items match "${searchText}".` : "This restaurant has no menu items yet."}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      />
    </View>
  );
}
