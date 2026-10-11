import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Send, Sparkles } from "lucide-react-native";
import { ChatBubble } from "../../components/assistant/ChatBubble";
import { ResultCard } from "../../components/assistant/ResultCard";
import { HorizontalCarousel } from "../../components/home/HorizontalCarousel";
import { Badge } from "../../components/ui/Badge";
import { TextField } from "../../components/ui/TextField";
import { interpretPrompt, runAssistantQuery } from "../../services/assistant";
import { ASSISTANT_NAME } from "../../constants/brand";
import { Restaurant, MenuItem } from "../../types/domain";
import { colors } from "../../constants/theme";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  restaurants?: Restaurant[];
  items?: MenuItem[];
}

type ResultEntry = { key: string } & ({ kind: "restaurant"; data: Restaurant } | { kind: "item"; data: MenuItem });

const EXAMPLE_PROMPTS = [
  "Find vegetarian dinner under ₹250.",
  "Recommend spicy biryani.",
  "What can I order for two people under ₹500?",
  "Find highly rated pizza nearby.",
];

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resultEntriesFor(message: ChatMessage): ResultEntry[] {
  const restaurantEntries: ResultEntry[] = (message.restaurants ?? []).map((r) => ({
    key: `restaurant-${r.id}`,
    kind: "restaurant",
    data: r,
  }));
  const itemEntries: ResultEntry[] = (message.items ?? []).map((i) => ({
    key: `item-${i.id}`,
    kind: "item",
    data: i,
  }));
  return [...restaurantEntries, ...itemEntries];
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const submitPrompt = useCallback((raw: string) => {
    const prompt = raw.trim();
    if (!prompt) return;

    const userMessage: ChatMessage = { id: nextId(), role: "user", text: prompt };
    const query = interpretPrompt(prompt);
    const result = runAssistantQuery(query);
    const assistantMessage: ChatMessage = {
      id: nextId(),
      role: "assistant",
      text: result.message,
      restaurants: result.restaurants,
      items: result.items,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft("");
  }, []);

  function handleSend() {
    submitPrompt(draft);
  }

  function handleExamplePress(prompt: string) {
    submitPrompt(prompt);
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top }} className="border-b border-border bg-card">
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="mr-2">
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">{ASSISTANT_NAME}</Text>
            <View className="mt-1">
              <Badge label="Offline smart-match mode" tone="muted" />
            </View>
          </View>
        </View>
      </View>

      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-primary/10 rounded-full p-5 mb-4">
            <Sparkles size={32} color={colors.primary} />
          </View>
          <Text className="text-lg font-semibold text-ink text-center mb-1">Ask {ASSISTANT_NAME} what to eat</Text>
          <Text className="text-sm text-muted text-center mb-5">
            {ASSISTANT_NAME} matches your request against real menu data — no live model is called in this mode.
          </Text>
          <View className="flex-row flex-wrap justify-center">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => handleExamplePress(prompt)}
                accessibilityRole="button"
                className="bg-primary/10 rounded-full px-3.5 py-2 mr-2 mb-2"
              >
                <Text className="text-sm font-medium text-primary">{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          renderItem={({ item: message }) => {
            const entries = resultEntriesFor(message);
            return (
              <View className="mb-3">
                <ChatBubble role={message.role} text={message.text} />
                {entries.length ? (
                  <View className="mt-2">
                    <HorizontalCarousel
                      data={entries}
                      keyExtractor={(entry) => entry.key}
                      contentContainerStyle={{ paddingHorizontal: 0 }}
                      renderItem={({ item: entry }) =>
                        entry.kind === "restaurant" ? (
                          <ResultCard type="restaurant" restaurant={entry.data} />
                        ) : (
                          <ResultCard type="item" item={entry.data} />
                        )
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <View
        className="flex-row items-center px-4 pt-2 border-t border-border bg-card"
        style={{ paddingBottom: insets.bottom + 10 }}
      >
        <View className="flex-1 mr-2">
          <TextField
            label="Message"
            value={draft}
            onChangeText={setDraft}
            placeholder={`Ask ${ASSISTANT_NAME} about the menu...`}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          className={`rounded-full p-3 ${draft.trim() ? "bg-primary active:bg-primary-deep" : "bg-border"}`}
        >
          <Send size={18} color={draft.trim() ? "#fff" : colors.muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
