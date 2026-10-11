import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, UtensilsCrossed } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { getMenuItemById, getRestaurantById } from "../../services/restaurants";
import { CustomizationSheet } from "../../components/food/CustomizationSheet";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useCartStore } from "../../store/cart-store";
import { CartCustomization } from "../../types/domain";
import { colors } from "../../constants/theme";

const SUCCESS_VISIBLE_MS = 700;
const FADE_MS = 200;

export default function FoodCustomizationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = params.id;

  const itemQuery = useQuery({
    queryKey: ["menu-item", itemId],
    queryFn: () => getMenuItemById(itemId as string),
    enabled: !!itemId,
  });

  const item = itemQuery.data;

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", item?.restaurantId],
    queryFn: () => getRestaurantById(item!.restaurantId),
    enabled: !!item?.restaurantId,
  });

  const restaurant = restaurantQuery.data;

  const addItem = useCartStore((s) => s.addItem);
  const replaceCartForNewRestaurant = useCartStore((s) => s.replaceCartForNewRestaurant);

  const [successVisible, setSuccessVisible] = useState(false);
  const successOpacity = useSharedValue(0);
  const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));

  function goBackAfterSuccess() {
    setSuccessVisible(true);
    successOpacity.value = withTiming(1, { duration: FADE_MS });
    setTimeout(() => {
      successOpacity.value = withTiming(0, { duration: FADE_MS });
      setTimeout(() => router.back(), FADE_MS + 20);
    }, SUCCESS_VISIBLE_MS);
  }

  function handleAddToCart(customization: CartCustomization, quantity: number) {
    if (!item) return;
    const result = addItem(item, customization, quantity);
    if (result.status === "different-restaurant") {
      Alert.alert(
        "Start a new cart?",
        "Your cart has items from a different restaurant. Adding this item will clear your current cart and start a new one.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start New Cart",
            style: "destructive",
            onPress: () => {
              replaceCartForNewRestaurant(item, customization, quantity);
              router.back();
            },
          },
        ]
      );
      return;
    }
    goBackAfterSuccess();
  }

  const isLoading = itemQuery.isLoading || (!!item && restaurantQuery.isLoading);
  const isError = itemQuery.isError || restaurantQuery.isError;

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <Skeleton width="100%" height={260} radius={0} />
        <View className="px-4 py-4">
          <Skeleton width="60%" height={22} />
          <View className="mt-3">
            <Skeleton width="90%" height={14} />
          </View>
          <View className="mt-2">
            <Skeleton width="40%" height={14} />
          </View>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="We couldn't load this item. Please try again."
          actionLabel="Retry"
          onAction={() => {
            itemQuery.refetch();
            restaurantQuery.refetch();
          }}
        />
      </View>
    );
  }

  if (!item || !restaurant) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <EmptyState icon={UtensilsCrossed} title="Item not found" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <CustomizationSheet
        item={item}
        restaurantIsOpen={restaurant.isOpen}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onClose={() => router.back()}
        onAddToCart={handleAddToCart}
      />

      {successVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: insets.top + 12,
              left: 16,
              right: 16,
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: colors.success,
            },
            successStyle,
          ]}
        >
          <Text className="text-center text-sm font-semibold text-white">Added to cart</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
