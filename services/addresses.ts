import AsyncStorage from "@react-native-async-storage/async-storage";
import { Address } from "../types/domain";
import { SEED_ADDRESSES } from "../data/seed/addresses";

const KEY = "aaharam:addresses";

async function readAll(): Promise<Address[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
  await AsyncStorage.setItem(KEY, JSON.stringify(SEED_ADDRESSES));
  return SEED_ADDRESSES;
}

export async function getAddresses(): Promise<Address[]> {
  return readAll();
}

export async function saveAddress(addr: Address): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((a) => a.id === addr.id);
  let next = index >= 0 ? all.map((a, i) => (i === index ? addr : a)) : [...all, addr];
  if (addr.isDefault) next = next.map((a) => (a.id === addr.id ? a : { ...a, isDefault: false }));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function deleteAddress(id: string): Promise<void> {
  const all = await readAll();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((a) => a.id !== id)));
}
