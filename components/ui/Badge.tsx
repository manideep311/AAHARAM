import React from "react";
import { View, Text } from "react-native";

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  muted: "bg-border text-muted",
};

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "muted" }) {
  const [bg, text] = TONE_CLASSES[tone].split(" ");
  return (
    <View className={`${bg} rounded-full px-2.5 py-1 self-start`}>
      <Text className={`text-xs font-semibold ${text}`}>{label}</Text>
    </View>
  );
}
