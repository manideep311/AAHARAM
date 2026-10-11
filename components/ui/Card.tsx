import React from "react";
import { View, ViewProps } from "react-native";

export function Card({ children, className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`bg-card rounded-2xl border border-border shadow-sm ${className}`} {...props}>
      {children}
    </View>
  );
}
