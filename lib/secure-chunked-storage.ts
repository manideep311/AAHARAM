import * as SecureStore from "expo-secure-store";

// SecureStore warns (and some Android devices fail) on values over ~2048 bytes, and a
// Supabase session (access token + refresh token + user JSON) routinely exceeds that. This
// adapter splits each value into numbered chunks and reassembles them on read. 600 chars per
// chunk stays under 2048 bytes even if every character were a 3-byte UTF-8 sequence.
const CHUNK_CHARS = 600;

// SecureStore keys may only contain alphanumerics, ".", "-" and "_".
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

const countKey = (base: string) => `${base}.count`;
const chunkKey = (base: string, index: number) => `${base}.${index}`;

async function removeItem(key: string): Promise<void> {
  const base = safeKey(key);
  const countRaw = await SecureStore.getItemAsync(countKey(base));
  const count = countRaw === null ? 0 : Number(countRaw);
  await SecureStore.deleteItemAsync(countKey(base));
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(base, i));
  }
}

async function getItem(key: string): Promise<string | null> {
  const base = safeKey(key);
  const countRaw = await SecureStore.getItemAsync(countKey(base));
  if (countRaw === null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(countRaw); i++) {
    const part = await SecureStore.getItemAsync(chunkKey(base, i));
    if (part === null) return null; // interrupted write: treat as no session
    parts.push(part);
  }
  return parts.join("");
}

async function setItem(key: string, value: string): Promise<void> {
  const base = safeKey(key);
  await removeItem(key);
  const count = Math.max(1, Math.ceil(value.length / CHUNK_CHARS));
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(chunkKey(base, i), value.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS));
  }
  // Written last, so a crash mid-write leaves no count and getItem returns null.
  await SecureStore.setItemAsync(countKey(base), String(count));
}

export const secureChunkedStorage = { getItem, setItem, removeItem };
