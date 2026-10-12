import React, { useEffect } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";
import { useNotifications } from "../../hooks/useNotifications";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { AppNotification } from "../../types/domain";
import { colors } from "../../constants/theme";

function Header({ topInset }: { topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        Notifications
      </Text>
    </View>
  );
}

// Lightweight "x minutes/hours/days ago" formatter -- no date library needed for this.
function relativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const content = (
    <View className="flex-row items-start px-4 py-3.5 border-b border-border">
      <View className={`mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-full ${notification.read ? "bg-border/60" : "bg-primary/10"}`}>
        <Bell size={16} color={notification.read ? colors.muted : colors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-2 text-sm font-semibold text-ink">{notification.title}</Text>
          {!notification.read ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
        </View>
        <Text className="mt-0.5 text-sm text-muted">{notification.body}</Text>
        <Text className="mt-1 text-xs text-muted">{relativeTime(notification.createdAt)}</Text>
      </View>
    </View>
  );
  if (!notification.orderId) return content;
  return (
    <Pressable onPress={() => router.push(`/tracking/${notification.orderId}`)} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { items, markAllRead, isLoading, signedIn } = useNotifications();

  // Opening this screen is the "I've seen my notifications" action, so the badges clear.
  useEffect(() => {
    markAllRead().catch(() => undefined);
  }, [markAllRead]);

  if (!signedIn) {
    return (
      <View className="flex-1 bg-bg">
        <Header topInset={insets.top} />
        <EmptyState
          icon={Bell}
          title="Sign in to get order updates"
          description="Status updates for your orders appear here."
          actionLabel="Sign in"
          onAction={() => router.push("/auth/login?returnTo=%2Fnotifications")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <Header topInset={insets.top} />
      {isLoading ? (
        <View className="px-4 py-2">
          <Skeleton width="100%" height={64} />
          <View className="mt-3">
            <Skeleton width="100%" height={64} />
          </View>
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="We'll let you know when there's something new." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}
