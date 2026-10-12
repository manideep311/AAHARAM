import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Sub-project 1 kept orders, addresses and favorites on the device and used a mock session.
// Those now live on the server, so the stale local copies are dropped once (not migrated).
const FLAG = "aaharam:migrated-v2";
const LEGACY_ASYNC_KEYS = [
  "aaharam:orders",
  "aaharam:order-request-ids",
  "aaharam:addresses",
  "aaharam:favorites:restaurants",
  "aaharam:favorites:items",
];
const LEGACY_SECURE_KEY = "aaharam:session";

export async function clearLegacyLocalData(): Promise<void> {
  if ((await AsyncStorage.getItem(FLAG)) === "true") return;
  await AsyncStorage.multiRemove(LEGACY_ASYNC_KEYS);
  await SecureStore.deleteItemAsync(LEGACY_SECURE_KEY).catch(() => undefined);
  await AsyncStorage.setItem(FLAG, "true");
}
