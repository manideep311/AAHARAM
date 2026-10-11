import { useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/auth-store";
import { verifyOtp } from "../../services/auth";

export default function Otp() {
  const { phone, devOtp } = useLocalSearchParams<{ phone: string; devOtp: string }>();
  const setUser = useAuthStore((s) => s.setUser);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onVerify() {
    setError(null);
    setVerifying(true);
    try {
      const user = await verifyOtp(phone ?? "", code);
      setUser(user);
      router.replace("/auth/location-select");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-2xl font-bold text-ink mb-1">Verify your number</Text>
      <Text className="text-base text-muted mb-6">Enter the 6-digit code sent to {phone}</Text>

      {devOtp ? (
        <View className="mb-4">
          <Badge label={`Dev OTP: ${devOtp}`} tone="muted" />
        </View>
      ) : null}

      <TextField
        label="OTP code"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^\d]/g, ""))}
        error={error ?? undefined}
      />

      <Button title="Verify" onPress={onVerify} loading={verifying} size="lg" />
    </View>
  );
}
