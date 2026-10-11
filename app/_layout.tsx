// @ts-expect-error - global.css has no type declarations; this is a CSS side-effect import for NativeWind
import "../global.css";

import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { useAuthStore } from "../store/auth-store";
import { getCurrentUser } from "../services/auth";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

const queryClient = new QueryClient();

export default function RootLayout() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setUser(user);
      setHydrated();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          {!isOnline ? (
            <View
              className="bg-danger items-center justify-center"
              style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, paddingTop: 44, paddingBottom: 8 }}
              accessibilityRole="alert"
            >
              <Text className="text-white text-xs font-semibold">You're offline — some actions may not work</Text>
            </View>
          ) : null}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding/index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="restaurant/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="food/[id]" options={{ presentation: "modal" }} />
            <Stack.Screen name="cart/index" options={{ presentation: "card" }} />
            <Stack.Screen name="checkout/index" options={{ presentation: "card" }} />
            <Stack.Screen name="checkout/payment" options={{ presentation: "card" }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
