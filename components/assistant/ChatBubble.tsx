import React from "react";
import { View, Text } from "react-native";
import { ASSISTANT_NAME } from "../../constants/brand";

export interface ChatBubbleProps {
  role: "user" | "assistant";
  text: string;
}

export function ChatBubble({ role, text }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <View className={`${isUser ? "items-end" : "items-start"}`}>
      {!isUser ? <Text className="text-xs font-semibold text-muted mb-1 ml-1">{ASSISTANT_NAME}</Text> : null}
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser ? "bg-primary rounded-br-md" : "bg-card border border-border rounded-bl-md"
        }`}
      >
        <Text className={`text-sm leading-5 ${isUser ? "text-white" : "text-ink"}`}>{text}</Text>
      </View>
    </View>
  );
}
