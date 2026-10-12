import * as SecureStore from "expo-secure-store";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { User } from "../types/domain";

// Guest mode is device-local only (no Supabase session): a flag in SecureStore.
const GUEST_KEY = "aaharam_guest";
const GUEST_USER: User = { id: "guest", name: "Guest", isGuest: true };

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("security purposes")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (lower.includes("not authorized")) {
    return "This email can't receive sign-in codes yet. The app owner needs to finish email setup (docs/backend-setup.md).";
  }
  return message;
}

export async function userFromSession(session: Session): Promise<User> {
  const { data } = await supabase.from("profiles").select("name, email").eq("id", session.user.id).maybeSingle();
  return {
    id: session.user.id,
    name: data?.name ?? "",
    email: data?.email ?? session.user.email ?? undefined,
    isGuest: false,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return userFromSession(data.session);
  return (await SecureStore.getItemAsync(GUEST_KEY)) === "true" ? GUEST_USER : null;
}

export async function signInAsGuest(): Promise<User> {
  await SecureStore.setItemAsync(GUEST_KEY, "true");
  return GUEST_USER;
}

export async function requestOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function verifyOtp(email: string, code: string): Promise<User> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.session) {
    throw new Error(error ? friendlyAuthError(error.message) : "That code is invalid or has expired. Request a new one.");
  }
  await SecureStore.deleteItemAsync(GUEST_KEY);
  return userFromSession(data.session);
}

export async function updateProfileName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await SecureStore.deleteItemAsync(GUEST_KEY);
}
