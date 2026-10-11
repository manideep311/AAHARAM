import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/auth-store";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants/brand";

export default function Splash() {
  const { user, hydrated } = useAuthStore();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("crave:onboarding-seen").then((v) => setOnboardingSeen(v === "true"));
  }, []);

  if (!hydrated || onboardingSeen === null) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Text className="text-white text-3xl font-extrabold tracking-wide">{BRAND_NAME}</Text>
        <Text className="text-white/80 mt-1">{BRAND_TAGLINE}</Text>
      </View>
    );
  }

  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/auth/login" />;
  return <Redirect href="/(tabs)/home" />;
}
