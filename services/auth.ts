import * as SecureStore from "expo-secure-store";
import { User } from "../types/domain";

const SESSION_KEY = "crave:session";

export async function getCurrentUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function signInAsGuest(): Promise<User> {
  const user: User = { id: "guest", name: "Guest", isGuest: true };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  return user;
}

// DEV-ONLY MOCK: no real SMS is sent. The OTP is returned directly to the
// caller so the UI can display it labeled "Dev OTP" — this must never ship
// to production without a real SMS provider wired in behind this function.
export async function requestOtp(phone: string): Promise<{ devOtp: string }> {
  return { devOtp: "123456" };
}

export async function verifyOtp(phone: string, code: string): Promise<User> {
  if (code !== "123456") throw new Error("Invalid OTP. Use the dev OTP shown on screen.");
  const user: User = { id: `user-${phone}`, name: "Demo User", phone, isGuest: false };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
