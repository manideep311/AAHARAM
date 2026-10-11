import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...props }: TextFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-ink mb-1.5">{label}</Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base text-ink bg-card ${error ? "border-red-400" : "border-border"}`}
        placeholderTextColor="#777777"
        {...props}
      />
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}
