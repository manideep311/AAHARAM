import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth-store";
import { requestOtp, verifyOtp } from "../../services/auth";

const RESEND_SECONDS = 60;

export default function Otp() {
  const { email, returnTo } = useLocalSearchParams<{ email: string; returnTo?: string }>();
  const setUser = useAuthStore((s) => s.setUser);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onVerify() {
    // Supabase's email OTP length is a project setting (6 by default); accept 6-8 digits.
    if (!/^\d{6,8}$/.test(code)) {
      setError("Enter the code from your email");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const user = await verifyOtp(email ?? "", code);
      setUser(user);
      if (returnTo && user.name.trim()) {
        router.replace(returnTo as any);
      } else {
        const returnQuery = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
        router.replace(`/auth/location-select${returnQuery}` as any);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    setResendMessage(null);
    setError(null);
    try {
      await requestOtp(email ?? "");
      setSecondsLeft(RESEND_SECONDS);
      setResendMessage("A new code is on its way.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend the code.");
    }
  }

  return (
    <View className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-2xl font-bold text-ink mb-1">Check your email</Text>
      <Text className="text-base text-muted mb-6">Enter the code we sent to {email}</Text>

      <TextField
        label="Sign-in code"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={8}
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^\d]/g, ""))}
        error={error ?? undefined}
      />

      <Button title="Verify" onPress={onVerify} loading={verifying} size="lg" />

      <Pressable
        onPress={onResend}
        disabled={secondsLeft > 0}
        accessibilityRole="button"
        accessibilityState={{ disabled: secondsLeft > 0 }}
        hitSlop={8}
        className="mt-5"
      >
        <Text className={`text-center text-sm font-semibold ${secondsLeft > 0 ? "text-muted" : "text-primary"}`}>
          {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
        </Text>
      </Pressable>
      {resendMessage ? <Text className="mt-2 text-center text-xs text-muted">{resendMessage}</Text> : null}
    </View>
  );
}
