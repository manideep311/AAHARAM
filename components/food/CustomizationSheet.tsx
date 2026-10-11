import React, { useMemo, useState } from "react";
import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { Circle, CircleCheck, Square, SquareCheck, X, Clock, AlertTriangle } from "lucide-react-native";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { QuantityStepper } from "../ui/QuantityStepper";
import { calculateLineItemPrice } from "../../lib/pricing/calculate";
import { formatCurrency } from "../../lib/formatting/currency";
import { CartCustomization, MenuItem, SpiceLevel } from "../../types/domain";
import { colors } from "../../constants/theme";

const SPECIAL_INSTRUCTIONS_MAX = 140;

const SPICE_LEVELS: { value: SpiceLevel; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "medium", label: "Medium" },
  { value: "spicy", label: "Spicy" },
];

const VEG_FLAG_BADGE: Record<string, { label: string; tone: "success" | "muted" } | null> = {
  veg: { label: "Veg", tone: "success" },
  "non-veg": { label: "Non-Veg", tone: "muted" },
  egg: { label: "Contains Egg", tone: "muted" },
  unknown: null,
};

interface CustomizationSheetProps {
  item: MenuItem;
  restaurantIsOpen: boolean;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  onAddToCart: (customization: CartCustomization, quantity: number) => void;
}

export function CustomizationSheet({ item, restaurantIsOpen, topInset, bottomInset, onClose, onAddToCart }: CustomizationSheetProps) {
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>({});
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel | undefined>(item.supportsSpiceLevel ? "medium" : undefined);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [quantity, setQuantity] = useState(1);

  const customization: CartCustomization = useMemo(
    () => ({
      optionSelections,
      addOnIds,
      spiceLevel,
      specialInstructions: specialInstructions.trim() ? specialInstructions.trim() : undefined,
    }),
    [optionSelections, addOnIds, spiceLevel, specialInstructions]
  );

  const unitPrice = calculateLineItemPrice(item, customization);
  const totalPrice = unitPrice * quantity;

  const missingRequiredGroup = item.optionGroups.some((group) => group.required && !optionSelections[group.id]);

  // Restaurant-closed takes precedence: an item on a closed restaurant can never be
  // ordered, regardless of its own isAvailable flag. See Task 13's gap-closure note.
  const unavailableReason = !restaurantIsOpen
    ? "This restaurant is currently closed"
    : !item.isAvailable
    ? "Currently unavailable"
    : null;

  const canAdd = !unavailableReason && !missingRequiredGroup;

  function selectOption(groupId: string, optionId: string) {
    setOptionSelections((prev) => ({ ...prev, [groupId]: optionId }));
  }

  function toggleAddOn(addOnId: string) {
    setAddOnIds((prev) => (prev.includes(addOnId) ? prev.filter((id) => id !== addOnId) : [...prev, addOnId]));
  }

  const dietaryBadge = VEG_FLAG_BADGE[item.vegFlag];

  let buttonLabel: string;
  if (!restaurantIsOpen) {
    buttonLabel = "Restaurant closed";
  } else if (!item.isAvailable) {
    buttonLabel = "Currently unavailable";
  } else if (missingRequiredGroup) {
    buttonLabel = "Select required options";
  } else {
    buttonLabel = "Add to Cart";
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ width: "100%", aspectRatio: 4 / 3 }}>
          <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="absolute items-center justify-center rounded-full bg-card/90"
            style={{ top: topInset + 10, left: 14, width: 36, height: 36 }}
          >
            <X size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View className="px-4 pt-4">
          <Text className="text-xl font-bold text-ink">{item.name}</Text>
          {dietaryBadge ? (
            <View className="mt-2">
              <Badge label={dietaryBadge.label} tone={dietaryBadge.tone} />
            </View>
          ) : null}
          <Text className="mt-2 text-sm text-muted">{item.description}</Text>
          <Text className="mt-2 text-base font-bold text-ink">{formatCurrency(item.basePrice)}</Text>
        </View>

        {!restaurantIsOpen ? (
          <View className="mx-4 mt-3 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
            <Clock size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">
              This restaurant is currently closed. Ordering is disabled until it reopens.
            </Text>
          </View>
        ) : !item.isAvailable ? (
          <View className="mx-4 mt-3 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
            <AlertTriangle size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">
              Currently unavailable. This item can't be added to your cart right now.
            </Text>
          </View>
        ) : null}

        {item.optionGroups.map((group) => (
          <View key={group.id} className="mt-5 px-4">
            <View className="flex-row items-center mb-2">
              <Text className="text-base font-bold text-ink">{group.name}</Text>
              {group.required ? (
                <View className="ml-2">
                  <Badge label="Required" tone="primary" />
                </View>
              ) : null}
            </View>
            {group.options.map((option) => {
              const selected = optionSelections[group.id] === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => selectOption(group.id, option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  className="flex-row items-center justify-between py-2.5"
                >
                  <View className="flex-row items-center">
                    {selected ? <CircleCheck size={20} color={colors.primary} /> : <Circle size={20} color={colors.muted} />}
                    <Text className="ml-2.5 text-sm text-ink">{option.label}</Text>
                  </View>
                  {option.priceDelta !== 0 ? (
                    <Text className="text-sm text-muted">+{formatCurrency(option.priceDelta)}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        {item.addOns.length > 0 ? (
          <View className="mt-5 px-4">
            <Text className="mb-2 text-base font-bold text-ink">Add-ons</Text>
            {item.addOns.map((addOn) => {
              const selected = addOnIds.includes(addOn.id);
              return (
                <Pressable
                  key={addOn.id}
                  onPress={() => toggleAddOn(addOn.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={addOn.name}
                  className="flex-row items-center justify-between py-2.5"
                >
                  <View className="flex-row items-center">
                    {selected ? <SquareCheck size={20} color={colors.primary} /> : <Square size={20} color={colors.muted} />}
                    <Text className="ml-2.5 text-sm text-ink">{addOn.name}</Text>
                  </View>
                  <Text className="text-sm text-muted">+{formatCurrency(addOn.priceDelta)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {item.supportsSpiceLevel ? (
          <View className="mt-5 px-4">
            <Text className="mb-2 text-base font-bold text-ink">Spice Level</Text>
            <View className="flex-row rounded-xl border border-border overflow-hidden">
              {SPICE_LEVELS.map((level, idx) => {
                const selected = spiceLevel === level.value;
                return (
                  <Pressable
                    key={level.value}
                    onPress={() => setSpiceLevel(level.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={level.label}
                    className={`flex-1 items-center py-2.5 ${selected ? "bg-primary" : "bg-card"} ${idx > 0 ? "border-l border-border" : ""}`}
                  >
                    <Text className={`text-sm font-semibold ${selected ? "text-white" : "text-ink"}`}>{level.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View className="mt-5 px-4">
          <TextField
            label="Special instructions (optional)"
            placeholder="E.g. less spicy, no onions"
            value={specialInstructions}
            onChangeText={(text) => setSpecialInstructions(text.slice(0, SPECIAL_INSTRUCTIONS_MAX))}
            multiline
            numberOfLines={3}
            maxLength={SPECIAL_INSTRUCTIONS_MAX}
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
          <Text className="-mt-3 mb-1 text-right text-xs text-muted">
            {specialInstructions.length}/{SPECIAL_INSTRUCTIONS_MAX}
          </Text>
        </View>

        <View className="mt-2 px-4">
          <Text className="mb-2 text-base font-bold text-ink">Quantity</Text>
          <QuantityStepper
            quantity={quantity}
            onIncrement={() => setQuantity((q) => q + 1)}
            onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
            min={1}
          />
        </View>
      </ScrollView>

      <View className="border-t border-border bg-card px-4 pt-3" style={{ paddingBottom: bottomInset + 12 }}>
        <View className="mb-2 flex-row items-baseline justify-between">
          <Text className="text-sm text-muted">Total ({quantity} {quantity === 1 ? "item" : "items"})</Text>
          <Text className="text-lg font-bold text-ink">{formatCurrency(totalPrice)}</Text>
        </View>
        <Button
          title={buttonLabel}
          disabled={!canAdd}
          accessibilityLabel={`${buttonLabel}, total ${formatCurrency(totalPrice)}`}
          onPress={() => onAddToCart(customization, quantity)}
          size="lg"
        />
      </View>
    </View>
  );
}
