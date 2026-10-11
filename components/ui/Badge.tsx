import React from "react";
import { View, Text } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { colors } from "../../constants/theme";

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  muted: "bg-border text-muted",
  danger: "bg-danger/10 text-danger",
};

const TONE_ICON_COLORS: Record<string, string> = {
  primary: colors.primary,
  success: colors.success,
  muted: colors.muted,
  danger: colors.danger,
};

interface BadgeProps {
  label: string;
  tone?: "primary" | "success" | "muted" | "danger";
  icon?: LucideIcon;
}

export function Badge({ label, tone = "primary", icon: Icon }: BadgeProps) {
  const [bg, text] = TONE_CLASSES[tone].split(" ");
  return (
    <View className={`${bg} flex-row items-center rounded-full px-2.5 py-1 self-start`}>
      {Icon ? <Icon size={12} color={TONE_ICON_COLORS[tone]} style={{ marginRight: 4 }} /> : null}
      <Text className={`text-xs font-semibold ${text}`}>{label}</Text>
    </View>
  );
}
