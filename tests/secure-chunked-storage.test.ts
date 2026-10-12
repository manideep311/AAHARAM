jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import * as SecureStore from "expo-secure-store";
import { secureChunkedStorage } from "../lib/secure-chunked-storage";

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

describe("secureChunkedStorage", () => {
  it("round-trips a large multi-byte value with every chunk under SecureStore's 2048-byte limit", async () => {
    const value = "é".repeat(2500) + "x".repeat(2500);
    await secureChunkedStorage.setItem("sb-test-auth-token", value);
    expect(await secureChunkedStorage.getItem("sb-test-auth-token")).toBe(value);
    for (const [key, chunk] of store) {
      if (!key.endsWith(".count")) expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(2048);
    }
  });

  it("returns null for a missing key", async () => {
    expect(await secureChunkedStorage.getItem("nothing-here")).toBeNull();
  });

  it("removeItem deletes every chunk and the count", async () => {
    await secureChunkedStorage.setItem("k", "y".repeat(3000));
    await secureChunkedStorage.removeItem("k");
    expect(store.size).toBe(0);
  });

  it("overwriting with a shorter value leaves no stale chunks", async () => {
    await secureChunkedStorage.setItem("k", "y".repeat(3000));
    await secureChunkedStorage.setItem("k", "short");
    expect(store.size).toBe(2); // k.0 + k.count
    expect(await secureChunkedStorage.getItem("k")).toBe("short");
  });

  it("sanitizes characters SecureStore does not allow in keys", async () => {
    await secureChunkedStorage.setItem("a:b/c", "v");
    expect(store.has("a_b_c.0")).toBe(true);
    expect(await secureChunkedStorage.getItem("a:b/c")).toBe("v");
  });
});
