import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { z } from "zod";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth-store";
import { requestOtp, signInAsGuest } from "../../services/auth";
import { BRAND_NAME } from "../../constants/brand";

const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Enter a valid 10-digit phone number");

export default function Login() {
  const setUser = useAuthStore((s) => s.setUser);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function onSendOtp() {
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid 10-digit phone number");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { devOtp } = await requestOtp(phone);
      router.push(`/auth/otp?phone=${encodeURIComponent(phone)}&devOtp=${encodeURIComponent(devOtp)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send OTP. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function onContinueAsGuest() {
    setGuestLoading(true);
    try {
      const user = await signInAsGuest();
      setUser(user);
      router.replace("/(tabs)/home");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-bg">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-3xl font-extrabold text-ink mb-1">{BRAND_NAME}</Text>
        <Text className="text-base text-muted mb-8">Sign in to order delicious food.</Text>

        <TextField
          label="Phone number"
          placeholder="9876543210"
          keyboardType="number-pad"
          maxLength={10}
          value={phone}
          onChangeText={(text) => setPhone(text.replace(/[^\d]/g, ""))}
          error={error ?? undefined}
        />

        <Button title="Send OTP" onPress={onSendOtp} loading={sending} size="lg" />

        <Text className="text-xs text-muted text-center mt-3">Dev mode: OTP will be shown on screen</Text>

        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-muted text-xs mx-3">OR</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <Pressable onPress={onContinueAsGuest} disabled={guestLoading} accessibilityRole="button" hitSlop={8}>
          <Text className="text-primary font-semibold text-center text-base">
            {guestLoading ? "Signing in..." : "Continue as Guest"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
