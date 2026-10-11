import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { validateCoupon } from "../../services/coupons";
import { useCartStore } from "../../store/cart-store";

interface CouponRowProps {
  restaurantId: string;
  subtotal: number;
}

export function CouponRow({ restaurantId, subtotal }: CouponRowProps) {
  const couponCode = useCartStore((s) => s.couponCode);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);

  const [inputCode, setInputCode] = useState("");
  const [applyError, setApplyError] = useState<string | undefined>(undefined);
  const [applying, setApplying] = useState(false);

  // Re-validates the stored coupon code against the current subtotal/restaurant every time
  // either changes, mirroring what a real server would do at checkout. React Query caches
  // this by its key, so it doesn't re-fire on every render.
  const appliedQuery = useQuery({
    queryKey: ["coupon-validate", couponCode, subtotal, restaurantId],
    queryFn: () => validateCoupon(couponCode as string, subtotal, restaurantId),
    enabled: !!couponCode,
  });

  async function handleApply() {
    const trimmed = inputCode.trim();
    if (!trimmed) return;
    setApplying(true);
    setApplyError(undefined);
    const result = await validateCoupon(trimmed, subtotal, restaurantId);
    setApplying(false);
    if (result.ok) {
      applyCoupon(result.coupon.code);
      setInputCode("");
    } else {
      setApplyError(result.reason);
    }
  }

  function handleRemove() {
    removeCoupon();
    setApplyError(undefined);
    setInputCode("");
  }

  if (couponCode) {
    const result = appliedQuery.data;

    return (
      <Card className="mb-3 p-3">
        {appliedQuery.isLoading ? (
          <Text className="text-sm text-muted">Checking coupon…</Text>
        ) : result && result.ok ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-bold text-ink">{result.coupon.code} applied</Text>
              <Text className="mt-0.5 text-xs text-muted">{result.coupon.description}</Text>
            </View>
            <Pressable onPress={handleRemove} accessibilityRole="button" accessibilityLabel="Remove coupon" hitSlop={6}>
              <Text className="text-sm font-semibold text-primary">Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-bold text-ink">{couponCode}</Text>
              <Text className="mt-0.5 text-xs text-danger">
                {result && !result.ok ? result.reason : "This coupon is no longer valid"}
              </Text>
            </View>
            <Pressable onPress={handleRemove} accessibilityRole="button" accessibilityLabel="Remove coupon" hitSlop={6}>
              <Text className="text-sm font-semibold text-primary">Remove</Text>
            </Pressable>
          </View>
        )}
      </Card>
    );
  }

  return (
    <Card className="mb-3 p-3">
      <TextField
        label="Coupon Code"
        placeholder="e.g. BIRYANI20"
        value={inputCode}
        onChangeText={(text) => {
          setInputCode(text.toUpperCase());
          if (applyError) setApplyError(undefined);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        error={applyError}
      />
      <Button title="Apply" onPress={handleApply} loading={applying} disabled={!inputCode.trim()} />
    </Card>
  );
}
