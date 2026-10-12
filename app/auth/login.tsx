import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth-store";
import { requestOtp, signInAsGuest } from "../../services/auth";
import { BRAND_NAME } from "../../constants/brand";

const emailSchema = z.string().trim().email("Enter a valid email address");

export default function Login() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  async function onSendCode() {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await requestOtp(result.data);
      const returnQuery = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
      router.push(`/auth/otp?email=${encodeURIComponent(result.data)}${returnQuery}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function onContinueAsGuest() {
    // Reached from a gated action ("Proceed to Checkout", a heart, Addresses): just go back.
    if (returnTo) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/home");
      return;
    }
    setGuestError(null);
    setGuestLoading(true);
    try {
      const user = await signInAsGuest();
      setUser(user);
      router.replace("/(tabs)/home");
    } catch (e) {
      setGuestError(e instanceof Error ? e.message : "Could not continue as guest. Try again.");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-bg">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-3xl font-extrabold text-ink mb-1">{BRAND_NAME}</Text>
        <Text className="text-base text-muted mb-8">
          {returnTo ? "Sign in to continue." : "Sign in to order delicious food."}
        </Text>

        <TextField
          label="Email address"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={error ?? undefined}
        />

        <Button title="Send code" onPress={onSendCode} loading={sending} size="lg" />

        <Text className="text-xs text-muted text-center mt-3">We'll email you a one-time sign-in code.</Text>

        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-muted text-xs mx-3">OR</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <Pressable onPress={onContinueAsGuest} disabled={guestLoading} accessibilityRole="button" hitSlop={8}>
          <Text className="text-primary font-semibold text-center text-base">
            {returnTo ? "Not now" : guestLoading ? "Signing in..." : "Continue as Guest"}
          </Text>
        </Pressable>
        {guestError ? <Text className="text-xs text-danger text-center mt-2">{guestError}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
