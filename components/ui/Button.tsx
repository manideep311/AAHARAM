import React from "react";
import { Pressable, Text, ActivityIndicator, PressableProps } from "react-native";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "md" | "lg";
  loading?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary active:bg-primary-deep",
  secondary: "bg-ink active:bg-black",
  outline: "bg-transparent border border-border active:bg-border",
};

const TEXT_CLASSES: Record<string, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-ink",
};

export function Button({ title, variant = "primary", size = "md", loading, disabled, ...props }: ButtonProps) {
  const padding = size === "lg" ? "py-4" : "py-3";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      className={`rounded-2xl ${padding} px-5 items-center justify-center ${VARIANT_CLASSES[variant]} ${disabled ? "opacity-50" : ""}`}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === "outline" ? "#202020" : "#fff"} /> : <Text className={`font-semibold text-base ${TEXT_CLASSES[variant]}`}>{title}</Text>}
    </Pressable>
  );
}
