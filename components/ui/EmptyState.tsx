import React from "react";
import { View, Text } from "react-native";
import { Button } from "./Button";
import { LucideIcon } from "lucide-react-native";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View className="bg-border/60 rounded-full p-5 mb-4">
        <Icon size={32} color="#777777" />
      </View>
      <Text className="text-lg font-semibold text-ink text-center mb-1">{title}</Text>
      {description ? <Text className="text-sm text-muted text-center mb-5">{description}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}
