import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react-native";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { colors } from "../../constants/theme";
import { BRAND_NAME } from "../../constants/brand";

const SETTINGS_STORAGE_KEY = "aaharam:notification-settings";

interface NotificationSettings {
  orderUpdates: boolean;
  promotions: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  orderUpdates: true,
  promotions: false,
};

const SAMPLE_TERMS_TEXT = `Sample Terms (Demo)

This is placeholder legal text for demonstration purposes only -- it is not a real
Terms of Service or Privacy Policy and must not be treated as one.

1. Demo Use Only
${BRAND_NAME} in this build is a development prototype. No real orders, payments, or
deliveries occur. Any data entered is stored only on this device for the current
session (or, for a few settings, in local on-device storage) and is never sent to
a real backend.

2. No Real Transactions
Checkout, payment, and tracking flows are simulated for demonstration. No money is
charged and no food is actually prepared or delivered.

3. Data Handling
This prototype does not transmit personal data to any server. Session data (such as
your profile name or phone number) is held only in memory and local device storage,
and is cleared when you sign out or reinstall the app.

4. Changes
Because this is placeholder text, it will never be updated with real legal terms
inside this demo. A production release would replace this entire document with
reviewed Terms of Service and Privacy Policy content.

Thank you for trying the ${BRAND_NAME} demo.`;

function Header({ topInset }: { topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        Settings
      </Text>
    </View>
  );
}

function ToggleRow({ label, description, value, onValueChange }: { label: string; description: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3.5 mb-3">
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-ink">{label}</Text>
        <Text className="text-xs text-muted mt-0.5">{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);

  // Read persisted settings once on mount; writes below only happen after this completes so we
  // never clobber a saved value with the in-memory default during the brief load window.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function updateSetting(patch: Partial<NotificationSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View className="flex-1 bg-bg">
      <Header topInset={insets.top} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <SectionHeader title="Notification Preferences" />
        <View className="px-4">
          {!loaded ? (
            <Text className="text-sm text-muted mb-3">Loading your saved preferences...</Text>
          ) : null}
          <ToggleRow
            label="Order Updates"
            description="Get notified when your order status changes"
            value={settings.orderUpdates}
            onValueChange={(v) => updateSetting({ orderUpdates: v })}
          />
          <ToggleRow
            label="Promotions & Offers"
            description="Get notified about deals and new offers"
            value={settings.promotions}
            onValueChange={(v) => updateSetting({ promotions: v })}
          />
        </View>

        <SectionHeader title="Legal" />
        <View className="px-4">
          <Pressable
            onPress={() => setTermsExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle Sample Terms (Demo)"
            className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3.5"
          >
            <Text className="text-base font-semibold text-ink">Sample Terms (Demo)</Text>
            {termsExpanded ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
          </Pressable>
          {termsExpanded ? (
            <View className="bg-card border border-border rounded-2xl px-4 py-3.5 mt-2">
              <Text className="text-xs leading-5 text-muted">{SAMPLE_TERMS_TEXT}</Text>
            </View>
          ) : null}
        </View>

        <SectionHeader title="About" />
        <View className="px-4">
          <View className="bg-card border border-border rounded-2xl px-4 py-3.5">
            <Text className="text-sm text-muted">
              {BRAND_NAME} App{"\n"}Version {appVersion}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
