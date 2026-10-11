// @ts-expect-error - global.css has no type declarations; this is a CSS side-effect import for NativeWind
import "../global.css";

import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store";
import { getCurrentUser } from "../services/auth";

const queryClient = new QueryClient();

export default function RootLayout() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);

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
