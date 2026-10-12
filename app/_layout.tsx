// @ts-expect-error - global.css has no type declarations; this is a CSS side-effect import for NativeWind
import "../global.css";

import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, Text, AppState } from "react-native";
import { useAuthStore } from "../store/auth-store";
import { getCurrentUser, userFromSession } from "../services/auth";
import { supabase } from "../lib/supabase";
import { clearLegacyLocalData } from "../lib/legacy-cleanup";
import { useFavoritesStore } from "../store/favorites-store";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useRealtimeSync } from "../hooks/useRealtimeSync";

const queryClient = new QueryClient();

// Lives inside SafeAreaProvider so it can read real safe-area insets (RootLayout
// itself mounts the provider, so it can't call useSafeAreaInsets directly).
function OfflineBanner({ isOnline }: { isOnline: boolean }) {
  const insets = useSafeAreaInsets();

  if (isOnline) {
    return null;
  }

  return (
    <View
      className="bg-danger items-center justify-center"
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, paddingTop: insets.top + 6, paddingBottom: 8 }}
      accessibilityRole="alert"
    >
      <Text className="text-white text-xs font-semibold">You're offline — some actions may not work</Text>
    </View>
  );
}

function RealtimeSync() {
  useRealtimeSync();
  return null;
}

export default function RootLayout() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const { isOnline } = useNetworkStatus();

  // React Native has no window focus; tell TanStack Query when the app is foregrounded so
  // stale queries (e.g. an order whose Realtime update was missed) refetch automatically.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await clearLegacyLocalData().catch(() => undefined);
      const user = await getCurrentUser().catch(() => null);
      if (cancelled) return;
      setUser(user);
      setHydrated();
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        useFavoritesStore.getState().reset();
        if (!useAuthStore.getState().user?.isGuest) setUser(null);
        queryClient.clear();
        return;
      }
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
        useFavoritesStore.getState().reset();
        // supabase-js warns against awaiting Supabase calls inside this callback (it can
        // deadlock the auth lock), so the profile fetch is deferred to the next tick.
        setTimeout(() => {
          userFromSession(session).then(setUser).catch(() => undefined);
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RealtimeSync />
          <StatusBar style="dark" />
          <OfflineBanner isOnline={isOnline} />
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
