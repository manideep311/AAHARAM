import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { MapPin } from "lucide-react-native";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useLocationStore } from "../../store/location-store";
import { useAuthStore } from "../../store/auth-store";
import { updateProfileName } from "../../services/auth";
import { colors } from "../../constants/theme";

function formatAddress(address: Location.LocationGeocodedAddress): string {
  const parts = [address.district || address.street, address.city || address.subregion, address.region].filter(
    (part): part is string => !!part
  );
  return parts.length > 0 ? parts.join(", ") : "Current location";
}

const LOCATION_TIMEOUT_MS = 9000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export default function LocationSelect() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const needsName = !!user && !user.isGuest && !user.name.trim();
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const setLabel = useLocationStore((s) => s.setLabel);
  const [status, setStatus] = useState<"requesting" | "granted" | "manual">("requesting");
  const [manualLabel, setManualLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function finish() {
    router.replace((returnTo ?? "/(tabs)/home") as any);
  }

  async function onSaveName() {
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2) {
      setNameError("Enter your name");
      return;
    }
    if (!user) return;
    setSavingName(true);
    setNameError(null);
    try {
      await updateProfileName(user.id, trimmed);
      setUser({ ...user, name: trimmed });
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Couldn't save your name. Try again.");
    } finally {
      setSavingName(false);
    }
  }

  // Location detection starts only once the (one-time) name step is done.
  useEffect(() => {
    if (!needsName) requestLocation();
  }, [needsName]);

  async function requestLocation() {
    setStatus("requesting");
    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== "granted") {
        setStatus("manual");
        return;
      }
      const position = await withTimeout(
        Location.getCurrentPositionAsync({}),
        LOCATION_TIMEOUT_MS,
        "Timed out waiting for a GPS fix."
      );
      const results = await withTimeout(
        Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        LOCATION_TIMEOUT_MS,
        "Timed out resolving your address."
      );
      const label = results[0] ? formatAddress(results[0]) : "Current location";
      setLabel(label);
      setStatus("granted");
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not detect your location.");
      setStatus("manual");
    }
  }

  function onSaveManual() {
    const trimmed = manualLabel.trim();
    setLabel(trimmed.length > 0 ? trimmed : "My location");
    finish();
  }

  function onSkip() {
    finish();
  }

  if (needsName) {
    return (
      <View className="flex-1 bg-bg px-6 justify-center">
        <Text className="text-2xl font-bold text-ink mb-1">What should we call you?</Text>
        <Text className="text-base text-muted mb-6">This is shown on your profile and orders.</Text>
        <TextField
          label="Your name"
          placeholder="e.g. Asha Rao"
          value={nameDraft}
          onChangeText={setNameDraft}
          error={nameError ?? undefined}
        />
        <Button title="Continue" onPress={onSaveName} loading={savingName} size="lg" />
      </View>
    );
  }

  if (status === "requesting") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="text-base text-muted mt-4 text-center">Detecting your location...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg px-6 justify-center">
      <View className="items-center mb-6">
        <View className="bg-primary/10 rounded-full p-5 mb-4">
          <MapPin size={36} color={colors.primary} />
        </View>
        <Text className="text-2xl font-bold text-ink text-center mb-1">Set your location</Text>
        <Text className="text-base text-muted text-center">
          {error ?? "We couldn't access your location. Enter it manually instead."}
        </Text>
      </View>

      <TextField
        label="Area / locality"
        placeholder="e.g. Indiranagar, Bengaluru"
        value={manualLabel}
        onChangeText={setManualLabel}
      />

      <View className="mb-3">
        <Button title="Save location" onPress={onSaveManual} size="lg" disabled={manualLabel.trim().length === 0} />
      </View>

      <Button title="Skip for now" onPress={onSkip} variant="outline" size="lg" />
    </View>
  );
}
