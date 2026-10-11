import React from "react";
import { View, Text } from "react-native";
import { Check, XCircle } from "lucide-react-native";
import { OrderStatus } from "../../types/domain";
import { ORDER_STATUS_SEQUENCE, ORDER_STATUS_LABELS } from "../../features/orders/status";

type StepState = "done" | "current" | "future" | "danger";

function StepRow({ label, state, isLast }: { label: string; state: StepState; isLast: boolean }) {
  const circleClass =
    state === "danger"
      ? "bg-danger"
      : state === "done" || state === "current"
      ? "bg-primary"
      : "bg-border";
  const lineClass = state === "done" ? "bg-primary" : "bg-border";
  const labelClass =
    state === "danger"
      ? "text-danger font-bold"
      : state === "current"
      ? "text-ink font-bold"
      : state === "done"
      ? "text-ink font-semibold"
      : "text-muted";

  return (
    <View className="flex-row">
      <View className="items-center mr-3" style={{ width: 24 }}>
        <View className={`items-center justify-center rounded-full ${circleClass}`} style={{ width: 24, height: 24 }}>
          {state === "danger" ? (
            <XCircle size={14} color="#fff" />
          ) : state === "done" ? (
            <Check size={14} color="#fff" />
          ) : state === "current" ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
          ) : null}
        </View>
        {!isLast ? <View className={`flex-1 ${lineClass}`} style={{ width: 2, marginTop: 2, marginBottom: 2 }} /> : null}
      </View>
      <View className={isLast ? "pb-0" : "pb-6"} style={{ flex: 1 }}>
        <Text className={`text-sm ${labelClass}`}>{label}</Text>
      </View>
    </View>
  );
}

export function TrackingTimeline({ status }: { status: OrderStatus }) {
  // Orders don't retain status history, only the current status -- so for a cancelled/failed
  // order we can't know exactly how far it progressed before the terminal event. We show
  // "Order Placed" as the one step we know always happened, then a single red terminal step
  // standing in for everything that would otherwise have followed.
  if (status === "cancelled" || status === "failed") {
    return (
      <View>
        <StepRow label={ORDER_STATUS_LABELS.placed} state="done" isLast={false} />
        <StepRow label={ORDER_STATUS_LABELS[status]} state="danger" isLast />
      </View>
    );
  }

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(status);

  return (
    <View>
      {ORDER_STATUS_SEQUENCE.map((s, i) => (
        <StepRow
          key={s}
          label={ORDER_STATUS_LABELS[s]}
          state={i < currentIndex ? "done" : i === currentIndex ? "current" : "future"}
          isLast={i === ORDER_STATUS_SEQUENCE.length - 1}
        />
      ))}
    </View>
  );
}
