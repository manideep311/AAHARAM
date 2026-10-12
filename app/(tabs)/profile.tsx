import React from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  MapPin,
  ReceiptText,
  Heart,
  SlidersHorizontal,
  Bell,
  Settings,
  CircleHelp,
  LogOut,
  ChevronRight,
  LucideIcon,
} from "lucide-react-native";
import { useAuthStore } from "../../store/auth-store";
import { useNotificationsStore } from "../../store/notifications-store";
import { signOut } from "../../services/auth";
import { requireSignIn } from "../../features/auth/requireSignIn";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { colors } from "../../constants/theme";

interface RowConfig {
  key: string;
  icon: LucideIcon;
  label: string;
  route: string;
  badgeCount?: number;
  requiresAccount?: boolean;
}

function ProfileRow({ icon: Icon, label, onPress, badgeCount, tone }: { icon: LucideIcon; label: string; onPress: () => void; badgeCount?: number; tone?: "default" | "danger" }) {
  const isDanger = tone === "danger";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center px-4 py-3.5 border-b border-border active:bg-border/40"
    >
      <View className={`mr-3 h-9 w-9 items-center justify-center rounded-full ${isDanger ? "bg-danger/10" : "bg-primary/10"}`}>
        <Icon size={18} color={isDanger ? colors.danger : colors.primary} />
      </View>
      <Text className={`flex-1 text-base font-medium ${isDanger ? "text-danger" : "text-ink"}`}>{label}</Text>
      {badgeCount && badgeCount > 0 ? (
        <View className="mr-2 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5">
          <Text className="text-xs font-bold text-white">{badgeCount > 99 ? "99+" : badgeCount}</Text>
        </View>
      ) : null}
      {!isDanger ? <ChevronRight size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  const isGuest = !user || user.isGuest;
  const initials = user?.name ? user.name.trim().charAt(0).toUpperCase() : "G";

  function handleLogoutPress() {
    Alert.alert(
      isGuest ? "Exit Guest Mode?" : "Log Out?",
      isGuest
        ? "You'll be taken back to the sign-in screen. Any guest session data will be cleared."
        : "You'll need to sign in again to access your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isGuest ? "Exit Guest Mode" : "Log Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            setUser(null);
            router.replace("/auth/login");
          },
        },
      ]
    );
  }

  const rows: RowConfig[] = [
    { key: "addresses", icon: MapPin, label: "Saved Addresses", route: "/addresses", requiresAccount: true },
    { key: "orders", icon: ReceiptText, label: "Order History", route: "/(tabs)/orders" },
    { key: "favorites", icon: Heart, label: "Favorites", route: "/(tabs)/favorites" },
    { key: "preferences", icon: SlidersHorizontal, label: "Edit Profile & Preferences", route: "/profile/edit" },
    { key: "notifications", icon: Bell, label: "Notifications", route: "/notifications", badgeCount: unreadCount },
    { key: "settings", icon: Settings, label: "Settings", route: "/profile/settings" },
    { key: "help", icon: CircleHelp, label: "Help & Support", route: "/profile/help" },
  ];

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="items-center px-4 pt-6 pb-5">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
            <Text className="text-3xl font-bold text-white">{initials}</Text>
          </View>
          <Text className="mt-3 text-xl font-bold text-ink">{user?.name ?? "Guest"}</Text>
          {user?.email ? <Text className="mt-0.5 text-sm text-muted">{user.email}</Text> : null}
        </View>

        {isGuest ? (
          <View className="mx-4 mb-5">
            <Card className="p-4">
              <Text className="mb-1 text-base font-bold text-ink">You're browsing as a guest</Text>
              <Text className="mb-3 text-sm text-muted">
                Sign in to save addresses, track orders, and keep your preferences across sessions.
              </Text>
              <Button
                title="Sign In"
                onPress={() => router.push("/auth/login?returnTo=%2F(tabs)%2Fprofile")}
                accessibilityLabel="Sign in"
              />
            </Card>
          </View>
        ) : null}

        <View className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((row) => (
            <ProfileRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              badgeCount={row.badgeCount}
              onPress={() => {
                if (row.requiresAccount && !requireSignIn(row.route)) return;
                router.push(row.route as any);
              }}
            />
          ))}
        </View>

        <View className="mx-4 mt-5 overflow-hidden rounded-2xl border border-border bg-card">
          <ProfileRow icon={LogOut} label={isGuest ? "Exit Guest Mode" : "Log Out"} onPress={handleLogoutPress} tone="danger" />
        </View>
      </ScrollView>
    </View>
  );
}
