import React, { useState } from "react";
import { View, Text, Pressable, Switch, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { usePreferencesStore } from "../../store/preferences-store";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { TextField } from "../../components/ui/TextField";
import { colors } from "../../constants/theme";

// Kept in sync with the categories shown on Home's cuisine carousel
// (app/(tabs)/home.tsx) so "favorite cuisines" means the same thing everywhere.
const CUISINE_OPTIONS = [
  "Biryani",
  "Pizza",
  "Burgers",
  "South Indian",
  "North Indian",
  "Chinese",
  "Desserts",
  "Healthy",
  "Street Food",
  "Beverages",
];

function Header({ title, topInset }: { title: string; topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function CuisineChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`mr-2 mb-2 rounded-full px-3.5 py-2 border ${active ? "bg-primary border-primary" : "bg-card border-border"}`}
    >
      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Profile editing screen.
 *
 * NOTE for future readers: this screen currently contains only the "Food
 * Preferences" section (Task 17). Task 18 adds a "Profile Details" section
 * (name/phone/email) ABOVE this one, inside the same ScrollView. Keep each
 * section wrapped in its own SectionHeader + View block so the two sections
 * stay visually and structurally independent.
 */
export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const preferences = usePreferencesStore((s) => s.preferences);
  const setPreferences = usePreferencesStore((s) => s.setPreferences);

  // Local text buffer for the budget field so the user can clear/retype
  // freely; only committed to the store as a number (or null) on change.
  const [budgetText, setBudgetText] = useState(
    preferences.budgetPerMeal != null ? String(preferences.budgetPerMeal) : ""
  );

  function toggleVegOnly(value: boolean) {
    setPreferences({ vegOnly: value });
  }

  function toggleCuisine(cuisine: string) {
    const next = preferences.favoriteCuisines.includes(cuisine)
      ? preferences.favoriteCuisines.filter((c) => c !== cuisine)
      : [...preferences.favoriteCuisines, cuisine];
    setPreferences({ favoriteCuisines: next });
  }

  function onBudgetChange(text: string) {
    const cleaned = text.replace(/[^0-9]/g, "");
    setBudgetText(cleaned);
    setPreferences({ budgetPerMeal: cleaned.length ? Number(cleaned) : null });
  }

  return (
    <View className="flex-1 bg-bg">
      <Header title="Edit Profile" topInset={insets.top} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Task 18 will insert a "Profile Details" section here. */}

        <SectionHeader title="Food Preferences" />
        <View className="px-4">
          <View className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3.5 mb-5">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold text-ink">Veg Only</Text>
              <Text className="text-xs text-muted mt-0.5">Only show vegetarian restaurants and dishes</Text>
            </View>
            <Switch
              value={preferences.vegOnly}
              onValueChange={toggleVegOnly}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Text className="text-sm font-medium text-ink mb-2">Favorite Cuisines</Text>
          <View className="flex-row flex-wrap mb-5">
            {CUISINE_OPTIONS.map((cuisine) => (
              <CuisineChip
                key={cuisine}
                label={cuisine}
                active={preferences.favoriteCuisines.includes(cuisine)}
                onPress={() => toggleCuisine(cuisine)}
              />
            ))}
          </View>

          <TextField
            label="Budget per Meal (₹)"
            placeholder="No preference"
            keyboardType="number-pad"
            value={budgetText}
            onChangeText={onBudgetChange}
          />
        </View>
      </ScrollView>
    </View>
  );
}
