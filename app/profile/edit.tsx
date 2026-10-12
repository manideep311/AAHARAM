import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react-native";
import { usePreferencesStore } from "../../store/preferences-store";
import { useAuthStore } from "../../store/auth-store";
import { updateProfileName } from "../../services/auth";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { colors } from "../../constants/theme";

// Only the display name is editable; the email is the sign-in identity and is read-only.
const profileDetailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
});
type ProfileDetailsValues = z.infer<typeof profileDetailsSchema>;

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
 * NOTE for future readers: this screen has two independent sections sharing one
 * ScrollView -- "Profile Details" (Task 18: name/phone/email, saved via
 * useAuthStore().setUser, session-only) and "Food Preferences" (Task 17: veg-only,
 * cuisines, budget, saved via usePreferencesStore). Keep them structurally separate.
 */
export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const preferences = usePreferencesStore((s) => s.preferences);
  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [savedJustNow, setSavedJustNow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isGuest = !user || user.isGuest;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileDetailsValues>({
    resolver: zodResolver(profileDetailsSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  // Keep the form in sync if the underlying user object changes (e.g. after sign-in);
  // doesn't fight with in-progress edits since it only depends on `user`, not on form state.
  useEffect(() => {
    reset({ name: user?.name ?? "" });
  }, [user, reset]);

  async function onSaveProfileDetails(values: ProfileDetailsValues) {
    if (!user || user.isGuest) return;
    setSaveError(null);
    try {
      await updateProfileName(user.id, values.name);
      setUser({ ...user, name: values.name });
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  }

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
        <SectionHeader title="Profile Details" />
        <View className="px-4">
          {isGuest ? (
            <View className="mb-1 rounded-2xl border border-border bg-card p-4">
              <Text className="text-sm text-muted mb-3">Sign in to save your name to your account.</Text>
              <Button
                title="Sign In"
                onPress={() => router.push("/auth/login?returnTo=%2Fprofile%2Fedit")}
                accessibilityLabel="Sign in"
              />
            </View>
          ) : (
            <>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <TextField
                    label="Name"
                    placeholder="Your full name"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={errors.name?.message}
                  />
                )}
              />
              <Text className="mb-1 text-xs font-semibold text-muted">Email</Text>
              <Text className="mb-4 text-base text-ink">{user?.email ?? "-"}</Text>
              <Button
                title={savedJustNow ? "Saved!" : "Save"}
                onPress={handleSubmit(onSaveProfileDetails)}
                accessibilityLabel="Save profile details"
              />
              {saveError ? <Text className="mt-2 text-xs text-danger">{saveError}</Text> : null}
            </>
          )}
        </View>

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
