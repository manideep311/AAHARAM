jest.mock("expo-secure-store", () => ({ deleteItemAsync: jest.fn(async () => undefined) }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { clearLegacyLocalData } from "../lib/legacy-cleanup";

beforeEach(async () => {
  await AsyncStorage.clear();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
});

describe("clearLegacyLocalData", () => {
  it("removes Sub-project 1's local orders, addresses and favorites but keeps the cart", async () => {
    await AsyncStorage.multiSet([
      ["aaharam:orders", "[]"],
      ["aaharam:order-request-ids", "{}"],
      ["aaharam:addresses", "[]"],
      ["aaharam:favorites:restaurants", "[]"],
      ["aaharam:favorites:items", "[]"],
      ["aaharam:cart", "{}"],
    ]);
    await clearLegacyLocalData();
    expect(await AsyncStorage.getItem("aaharam:orders")).toBeNull();
    expect(await AsyncStorage.getItem("aaharam:addresses")).toBeNull();
    expect(await AsyncStorage.getItem("aaharam:favorites:items")).toBeNull();
    expect(await AsyncStorage.getItem("aaharam:cart")).toBe("{}");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("aaharam:session");
  });

  it("runs only once", async () => {
    await clearLegacyLocalData();
    await AsyncStorage.setItem("aaharam:orders", "[]");
    await clearLegacyLocalData();
    expect(await AsyncStorage.getItem("aaharam:orders")).toBe("[]");
  });
});
