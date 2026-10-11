import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useAuthStore } from "../store/auth-store";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants/brand";

export default function Splash() {
  const { user, hydrated } = useAuthStore();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    AsyncStorage.getItem("crave:onboarding-seen").then((v) => setOnboardingSeen(v === "true"));
  }, []);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    scale.value = withTiming(1, { duration: 500 });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!hydrated || onboardingSeen === null) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Animated.View style={logoStyle} className="items-center">
          <Text className="text-white text-3xl font-extrabold tracking-wide">{BRAND_NAME}</Text>
          <Text className="text-white/80 mt-1">{BRAND_TAGLINE}</Text>
        </Animated.View>
      </View>
    );
  }

  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/auth/login" />;
  return <Redirect href="/(tabs)/home" />;
}
