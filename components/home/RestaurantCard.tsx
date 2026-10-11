import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import { Restaurant } from "../../types/domain";
import { SEED_OFFERS } from "../../data/seed/offers";
import { Card } from "../ui/Card";
import { ImageWithFallback } from "../ui/ImageWithFallback";
import { Badge } from "../ui/Badge";
import { RatingPill } from "../ui/RatingPill";
import { formatCurrency } from "../../lib/formatting/currency";
import { useFavoritesStore } from "../../store/favorites-store";
import { colors } from "../../constants/theme";

const CARD_WIDTH = 260;

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const isFavorite = useFavoritesStore((s) => s.restaurantIds.includes(restaurant.id));
  const toggleRestaurant = useFavoritesStore((s) => s.toggleRestaurant);

  function onPress() {
    router.push(`/restaurant/${restaurant.id}`);
  }

  function onToggleFavorite() {
    toggleRestaurant(restaurant.id);
  }

  const offer = SEED_OFFERS.find((o) => o.restaurantId === restaurant.id);
  const badgeLabel = offer?.title ?? restaurant.tags[0];

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ width: CARD_WIDTH }}>
      <Card className="overflow-hidden">
        <View style={{ aspectRatio: 16 / 9 }}>
          <ImageWithFallback uri={restaurant.coverImageUrl} style={{ width: "100%", height: "100%" }} />
          <Pressable
            onPress={onToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Remove ${restaurant.name} from favorites` : `Add ${restaurant.name} to favorites`}
            hitSlop={8}
            className="absolute top-2 right-2 bg-white/90 rounded-full p-2"
          >
            <Heart size={16} color={colors.primary} fill={isFavorite ? colors.primary : "transparent"} />
          </Pressable>
          {!restaurant.isOpen ? (
            <View className="absolute inset-0 bg-black/40 items-center justify-center">
              <Text className="text-white font-semibold text-sm">Closed</Text>
            </View>
          ) : null}
        </View>
        <View className="p-3">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text className="text-sm text-muted mt-0.5" numberOfLines={1}>
            {restaurant.cuisines.join(" · ")}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <RatingPill rating={restaurant.rating} reviewCount={restaurant.ratingCount} />
            {badgeLabel ? <Badge label={badgeLabel} /> : null}
          </View>
          <Text className="text-xs text-muted mt-2">
            {restaurant.etaMinutes} min ·{" "}
            {restaurant.deliveryFee === 0 ? "Free delivery" : `${formatCurrency(restaurant.deliveryFee)} delivery`}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
