import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp, Mail } from "lucide-react-native";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { colors } from "../../constants/theme";

const SUPPORT_EMAIL = "support@example.com";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

const FAQS: Faq[] = [
  {
    id: "where-is-my-order",
    question: "Where is my order?",
    answer:
      "Open Orders from the tab bar and tap an active order to see the Track Order screen. In this build, tracking is simulated for demo purposes -- there's no real courier or live GPS, so the status advances on its own every few seconds to show you the flow.",
  },
  {
    id: "refunds",
    question: "How do refunds work?",
    answer:
      "This app is a development prototype and payments are mocked -- no real money is ever charged, so there's nothing to refund. In a production version, refunds would be processed back to your original payment method within 5-7 business days.",
  },
  {
    id: "change-address",
    question: "How do I change my delivery address?",
    answer:
      "Go to Profile > Saved Addresses to add, edit, or remove addresses. You can also switch the address used for a specific order from the Checkout screen before placing it.",
  },
  {
    id: "cancel-order",
    question: "Can I cancel an order after placing it?",
    answer:
      "In this demo, orders advance automatically through the simulated status flow and don't currently support in-app cancellation. In a live app, you'd typically be able to cancel while the order is still in \"Placed\" or \"Confirmed\" status.",
  },
  {
    id: "payment-methods",
    question: "What payment methods are supported?",
    answer:
      "The checkout screen in this build uses a mock payment flow for demonstration -- no real payment gateway is connected, and no card or UPI details are collected or stored.",
  },
  {
    id: "notifications",
    question: "Why am I not getting notifications?",
    answer:
      "In-app notifications are generated locally as your tracked orders progress -- check Profile > Settings to confirm Order Updates are enabled. Since this is a demo, there are no push notifications sent outside the app.",
  },
];

function Header({ topInset }: { topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        Help & Support
      </Text>
    </View>
  );
}

function FaqRow({ faq, expanded, onToggle }: { faq: Faq; expanded: boolean; onToggle: () => void }) {
  return (
    <View className="bg-card border border-border rounded-2xl mb-2.5 overflow-hidden">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={faq.question}
        className="flex-row items-center justify-between px-4 py-3.5"
      >
        <Text className="flex-1 pr-3 text-sm font-semibold text-ink">{faq.question}</Text>
        {expanded ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
      </Pressable>
      {expanded ? (
        <View className="px-4 pb-3.5">
          <Text className="text-sm leading-5 text-muted">{faq.answer}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View className="flex-1 bg-bg">
      <Header topInset={insets.top} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <SectionHeader title="Frequently Asked Questions" />
        <View className="px-4">
          {FAQS.map((faq) => (
            <FaqRow
              key={faq.id}
              faq={faq}
              expanded={expandedId === faq.id}
              onToggle={() => setExpandedId((prev) => (prev === faq.id ? null : faq.id))}
            />
          ))}
        </View>

        <SectionHeader title="Still Need Help?" />
        <View className="px-4">
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            accessibilityRole="button"
            accessibilityLabel="Contact Support"
            className="flex-row items-center bg-card border border-border rounded-2xl px-4 py-3.5"
          >
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Mail size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink">Contact Support</Text>
              <Text className="text-xs text-muted mt-0.5">{SUPPORT_EMAIL} (placeholder support channel)</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
