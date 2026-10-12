import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, AlertTriangle, ShoppingBag, MapPin, Smartphone, CreditCard, Landmark, Banknote, LucideIcon, Check, Clock } from "lucide-react-native";
import { useCartStore } from "../../store/cart-store";
import { useCheckoutSelectionStore } from "../../store/checkout-selection-store";
import { getAddresses } from "../../services/addresses";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { validateCoupon } from "../../services/coupons";
import { calculateCartTotals } from "../../lib/pricing/calculate";
import { formatCurrency } from "../../lib/formatting/currency";
import { PriceBreakdown } from "../../components/cart/PriceBreakdown";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PaymentMethod } from "../../types/domain";
import { colors } from "../../constants/theme";

function Header({ title, topInset }: { title: string; topInset: number }) {
  return (
    <View className="flex-row items-center bg-bg px-2" style={{ paddingTop: topInset + 8, paddingBottom: 8 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="p-2">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text className="ml-1 text-lg font-bold text-ink" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; sublabel: string; icon: LucideIcon }[] = [
  { id: "upi", label: "UPI", sublabel: "Dev simulation", icon: Smartphone },
  { id: "card", label: "Credit / Debit Card", sublabel: "Dev simulation", icon: CreditCard },
  { id: "netbanking", label: "Net Banking", sublabel: "Dev simulation", icon: Landmark },
  { id: "cod", label: "Cash on Delivery", sublabel: "Pay when it arrives", icon: Banknote },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();

  const restaurantId = useCartStore((s) => s.restaurantId);
  const lines = useCartStore((s) => s.lines);
  const couponCode = useCartStore((s) => s.couponCode);

  const selectedAddressId = useCheckoutSelectionStore((s) => s.selectedAddressId);
  const setSelectedAddressId = useCheckoutSelectionStore((s) => s.setSelectedAddressId);
  const paymentMethod = useCheckoutSelectionStore((s) => s.paymentMethod);
  const setPaymentMethod = useCheckoutSelectionStore((s) => s.setPaymentMethod);

  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const addresses = addressesQuery.data ?? [];

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => getRestaurantById(restaurantId as string),
    enabled: !!restaurantId,
  });
  const menuQuery = useQuery({
    queryKey: ["menu", restaurantId],
    queryFn: () => getMenuForRestaurant(restaurantId as string),
    enabled: !!restaurantId,
  });

  const restaurant = restaurantQuery.data;
  const menuItems = menuQuery.data?.items ?? [];

  const baseTotals = useMemo(
    () => (restaurant ? calculateCartTotals(lines, menuItems, restaurant, null) : null),
    [lines, menuItems, restaurant]
  );
  const subtotal = baseTotals?.subtotal ?? 0;

  const couponValidationQuery = useQuery({
    queryKey: ["coupon-validate", couponCode, subtotal, restaurantId],
    queryFn: () => validateCoupon(couponCode as string, subtotal, restaurantId as string),
    enabled: !!couponCode && !!restaurantId && !!restaurant,
  });
  const resolvedCoupon = couponValidationQuery.data && couponValidationQuery.data.ok ? couponValidationQuery.data.coupon : null;

  // Recomputed fresh from the current cart + resolved restaurant + resolved coupon on every
  // render; never derived from anything passed through navigation params.
  const totals = useMemo(
    () => (restaurant ? calculateCartTotals(lines, menuItems, restaurant, resolvedCoupon) : null),
    [lines, menuItems, restaurant, resolvedCoupon]
  );

  // Default the delivery address to the user's default address the first time addresses load,
  // but only if nothing has been explicitly selected yet (so returning from the address picker
  // never clobbers the user's choice).
  const didDefaultAddress = useRef(false);
  useEffect(() => {
    if (didDefaultAddress.current) return;
    if (!addressesQuery.data || selectedAddressId) {
      if (selectedAddressId) didDefaultAddress.current = true;
      return;
    }
    if (addressesQuery.data.length === 0) return;
    const defaultAddress = addressesQuery.data.find((a) => a.isDefault) ?? addressesQuery.data[0];
    setSelectedAddressId(defaultAddress.id);
    didDefaultAddress.current = true;
  }, [addressesQuery.data, selectedAddressId, setSelectedAddressId]);

  const resolvedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;

  // Transient note for THIS checkout only -- never written back to the saved Address (a one-off
  // note like "leave with roommate today" must not become a standing property of "Home").
  // Seeded from the address's saved note and re-seeded when the address changes; carried to the
  // payment screen as a query string and sent to place-order, which stores it on the order.
  const [instructionsDraft, setInstructionsDraft] = useState(resolvedAddress?.instructions ?? "");
  const seededAddressId = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedAddress && seededAddressId.current !== resolvedAddress.id) {
      setInstructionsDraft(resolvedAddress.instructions ?? "");
      seededAddressId.current = resolvedAddress.id;
    }
  }, [resolvedAddress]);

  // Stable for the lifetime of this screen instance; this is what makes createOrder's retry
  // idempotent across double-taps on the payment screen. Backing out and re-entering checkout
  // remounts this screen, generating a fresh id for the new checkout session.
  const [clientRequestId] = useState(() => `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const [placingOrder, setPlacingOrder] = useState(false);

  async function handlePlaceOrder() {
    if (!resolvedAddress || !restaurant || lines.length === 0 || placingOrder) return;
    setPlacingOrder(true);
    try {
      // Carried as a query string like clientRequestId; payment.tsx sends it to place-order.
      const trimmed = instructionsDraft.trim();
      const instructionsQuery = trimmed ? `&instructions=${encodeURIComponent(trimmed)}` : "";
      router.push(`/checkout/payment?clientRequestId=${encodeURIComponent(clientRequestId)}${instructionsQuery}`);
    } finally {
      setPlacingOrder(false);
    }
  }

  if (lines.length === 0) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Checkout" topInset={insets.top} />
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Add items to your cart before checking out."
          actionLabel="Browse Restaurants"
          onAction={() => router.push("/(tabs)/home")}
        />
      </View>
    );
  }

  const isLoading = restaurantQuery.isLoading || menuQuery.isLoading || addressesQuery.isLoading;
  const isError = restaurantQuery.isError || menuQuery.isError || addressesQuery.isError;

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Checkout" topInset={insets.top} />
        <View className="px-4 py-2">
          <Skeleton width="100%" height={100} />
          <View className="mt-3">
            <Skeleton width="100%" height={140} />
          </View>
          <View className="mt-3">
            <Skeleton width="100%" height={180} />
          </View>
        </View>
      </View>
    );
  }

  if (isError || !restaurant) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Checkout" topInset={insets.top} />
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="We couldn't load checkout details. Please try again."
          actionLabel="Retry"
          onAction={() => {
            restaurantQuery.refetch();
            menuQuery.refetch();
            addressesQuery.refetch();
          }}
        />
      </View>
    );
  }

  // UI-layer safety net, consistent with the rest of the app's "clearly explain + disable"
  // pattern -- this is NOT the authoritative guard (that's createOrder's isOpen check, which must
  // hold regardless of this). It just keeps a normal user from ever reaching the thrown-error
  // fallback in the first place.
  const restaurantClosed = !restaurant.isOpen;
  const canPlaceOrder = !!resolvedAddress && lines.length > 0 && !placingOrder && !restaurantClosed;

  return (
    <View className="flex-1 bg-bg">
      <Header title="Checkout" topInset={insets.top} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 140 }}>
        {restaurantClosed ? (
          <View className="mb-3 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
            <Clock size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">
              {restaurant.name} is currently closed and can't accept orders right now.
            </Text>
          </View>
        ) : null}

        {/* Delivery address */}
        <Card className="mb-3 p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 flex-row">
              <MapPin size={18} color={colors.primary} />
              <View className="ml-2 flex-1">
                <Text className="text-sm font-bold text-ink">Delivery Address</Text>
                {resolvedAddress ? (
                  <>
                    <Text className="mt-1 text-sm text-ink">{resolvedAddress.recipientName} · {resolvedAddress.phone}</Text>
                    <Text className="mt-0.5 text-sm text-muted">
                      {resolvedAddress.line1}, {resolvedAddress.area}, {resolvedAddress.city}, {resolvedAddress.state}{" "}
                      {resolvedAddress.postalCode}
                    </Text>
                  </>
                ) : (
                  <Text className="mt-1 text-sm text-danger">No address selected. Add or select one to continue.</Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/addresses?selectMode=true")}
              accessibilityRole="button"
              accessibilityLabel="Change delivery address"
              hitSlop={6}
            >
              <Text className="text-sm font-semibold text-primary">Change</Text>
            </Pressable>
          </View>
        </Card>

        {/* Delivery instructions */}
        <Card className="mb-3 p-4">
          <TextField
            label="Delivery Instructions (optional)"
            placeholder="e.g. Leave with security guard"
            value={instructionsDraft}
            onChangeText={setInstructionsDraft}
            maxLength={140}
            multiline
          />
        </Card>

        {/* Order summary */}
        <Card className="mb-3 p-4">
          <Text className="mb-2 text-sm font-bold text-ink">{restaurant.name}</Text>
          {lines.map((line) => {
            const item = menuItems.find((m) => m.id === line.menuItemId);
            return (
              <View key={line.lineId} className="flex-row items-center justify-between py-1">
                <Text className="flex-1 pr-3 text-sm text-ink" numberOfLines={1}>
                  {line.quantity} × {item?.name ?? "Item no longer available"}
                </Text>
                <Text className="text-sm font-semibold text-ink">{formatCurrency(line.unitPrice * line.quantity)}</Text>
              </View>
            );
          })}
        </Card>

        {totals ? (
          <View className="mb-3">
            <PriceBreakdown totals={totals} originalDeliveryFee={restaurant.deliveryFee} />
          </View>
        ) : null}

        {/* Payment method */}
        <Card className="mb-3 p-4">
          <Text className="mb-3 text-sm font-bold text-ink">Payment Method</Text>
          {PAYMENT_METHODS.map((method) => {
            const isActive = paymentMethod === method.id;
            const Icon = method.icon;
            return (
              <Pressable
                key={method.id}
                onPress={() => setPaymentMethod(method.id)}
                accessibilityRole="button"
                accessibilityLabel={`Pay with ${method.label}`}
                className={`mb-2 flex-row items-center justify-between rounded-xl border px-3 py-3 ${
                  isActive ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <View className="flex-row items-center">
                  <Icon size={18} color={isActive ? colors.primary : colors.muted} />
                  <View className="ml-3">
                    <Text className="text-sm font-semibold text-ink">{method.label}</Text>
                    <Text className="text-xs text-muted">{method.sublabel}</Text>
                  </View>
                </View>
                {isActive ? (
                  <View className="rounded-full bg-primary p-1">
                    <Check size={14} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {totals ? (
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Total</Text>
            <Text className="text-lg font-bold text-ink">{formatCurrency(totals.total)}</Text>
          </View>
        ) : null}
        <Button
          title={restaurantClosed ? "Restaurant Closed" : "Place Order"}
          size="lg"
          disabled={!canPlaceOrder}
          loading={placingOrder}
          accessibilityLabel={restaurantClosed ? "Restaurant closed, cannot place order" : "Place Order"}
          onPress={handlePlaceOrder}
        />
      </View>
    </View>
  );
}
