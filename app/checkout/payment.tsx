import React, { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, FlaskConical, Smartphone, CreditCard, Landmark, Banknote, AlertTriangle, LucideIcon, Clock } from "lucide-react-native";
import { useCartStore } from "../../store/cart-store";
import { useCheckoutSelectionStore } from "../../store/checkout-selection-store";
import { getAddresses } from "../../services/addresses";
import { getRestaurantById, getMenuForRestaurant } from "../../services/restaurants";
import { validateCoupon } from "../../services/coupons";
import { createOrder } from "../../services/orders";
import { calculateCartTotals } from "../../lib/pricing/calculate";
import { formatCurrency } from "../../lib/formatting/currency";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
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

const METHOD_META: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  upi: { label: "UPI", icon: Smartphone },
  card: { label: "Credit / Debit Card", icon: CreditCard },
  netbanking: { label: "Net Banking", icon: Landmark },
  cod: { label: "Cash on Delivery", icon: Banknote },
};

const PROCESSING_DELAY_MS = 1500;

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ clientRequestId?: string; instructions?: string }>();
  const clientRequestId = params.clientRequestId;
  // Read-only display only -- this is the user's one-off note for THIS order, carried purely as
  // a query string (like clientRequestId). It is never written back to the saved Address and
  // never sent to createOrder (CreateOrderInput has no field for it); it is simply shown back to
  // the user here as confirmation of what they typed, then dropped.
  const deliveryInstructions = params.instructions;

  const restaurantId = useCartStore((s) => s.restaurantId);
  const lines = useCartStore((s) => s.lines);
  const couponCode = useCartStore((s) => s.couponCode);

  const selectedAddressId = useCheckoutSelectionStore((s) => s.selectedAddressId);
  const paymentMethod = useCheckoutSelectionStore((s) => s.paymentMethod);

  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const resolvedAddress = addressesQuery.data?.find((a) => a.id === selectedAddressId) ?? null;

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

  const totals = useMemo(
    () => (restaurant ? calculateCartTotals(lines, menuItems, restaurant, resolvedCoupon) : null),
    [lines, menuItems, restaurant, resolvedCoupon]
  );

  // --- Double-tap / concurrent-submit guard -------------------------------------------------
  // submittingRef is checked and set SYNCHRONOUSLY at the very top of handleConfirm, before any
  // await. That closes the gap a React state update can't: two taps dispatched in the same
  // event-loop tick (before a re-render can disable the button via isSubmitting) would otherwise
  // both pass a "disabled" check based on state. The ref makes the second tap's handleConfirm
  // call return immediately, no matter how fast the taps are, so createOrder is never in flight
  // twice for this screen instance. isSubmitting (state) only drives the UI: Button's `loading`
  // prop and the disabled styling. The ref is reset to false ONLY on the error path, right before
  // the retry button becomes usable again -- on success it is deliberately left `true` forever,
  // since this screen is navigating away and must never fire another createOrder.
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI-layer safety net (NOT the authoritative guard -- that's createOrder's isOpen check in
  // services/orders.ts, which holds regardless of this): keeps a user from paying for an order
  // from a restaurant that closed after checkout but before this screen was reached.
  const restaurantClosed = !!restaurant && !restaurant.isOpen;

  // Guards against calling setState / router.replace after the user has navigated away (e.g.
  // tapped back while a request was still in flight). submittingRef itself is intentionally NOT
  // gated on this -- it must stay true regardless of mount state, so even a stray tap delivered
  // to this screen instance just before it unmounts can never re-enter createOrder.
  const mountedRef = useRef(true);
  React.useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  async function handleConfirm() {
    if (submittingRef.current) return;
    if (!resolvedAddress || !restaurant || !clientRequestId || lines.length === 0) return;
    if (restaurantClosed) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (paymentMethod !== "cod") {
        setPhase("processing");
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));
      }

      // NOTE: this screen previously injected a deterministic simulated failure AFTER createOrder
      // succeeded, on every single first attempt for a non-COD method. That meant every demo
      // online payment hit a scary unlabeled error, and -- because the throw happened after the
      // order already existed -- a user who abandoned at that point left an orphaned "placed"
      // order with a non-cleared cart. Removed outright: a normal demo checkout now succeeds on
      // the first try by default, and the retry UI/logic below (phase "error", Retry Payment
      // button, submittingRef reset) remains fully intact and exercised by any genuine failure --
      // e.g. createOrder's closed-restaurant guard, or a real storage/network error.
      const order = await createOrder({
        clientRequestId,
        restaurantId: restaurant.id,
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, customization: l.customization })),
        couponCode: resolvedCoupon?.code ?? null,
        addressId: resolvedAddress.id,
        paymentMethod,
        deliveryInstructions: deliveryInstructions ?? null,
        expectedTotal: totals?.total ?? 0,
      });

      useCartStore.getState().clearCart();
      if (!mountedRef.current) return;
      router.replace(`/order-confirmation/${order.id}`);
      // No reset of submittingRef/isSubmitting here: this screen instance is unmounting, and the
      // trigger must stay disabled for its entire remaining lifetime.
    } catch (err) {
      if (!mountedRef.current) return;
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      // Re-enable the trigger only now that the failed attempt has fully resolved, so a retry
      // tap can start a new, single, non-overlapping call.
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Payment" topInset={insets.top} />
        <EmptyState icon={AlertTriangle} title="Your cart is empty" description="Go back and add items before paying." />
      </View>
    );
  }

  const isLoading = restaurantQuery.isLoading || menuQuery.isLoading || addressesQuery.isLoading;
  const isError = restaurantQuery.isError || menuQuery.isError || addressesQuery.isError;

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Payment" topInset={insets.top} />
        <View className="px-4 py-2">
          <Skeleton width="100%" height={100} />
          <View className="mt-3">
            <Skeleton width="100%" height={140} />
          </View>
        </View>
      </View>
    );
  }

  if (isError || !restaurant || !clientRequestId) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Payment" topInset={insets.top} />
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="We couldn't load checkout details. Please go back and try again."
          actionLabel="Back to Checkout"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (!resolvedAddress) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Payment" topInset={insets.top} />
        <EmptyState
          icon={AlertTriangle}
          title="No delivery address selected"
          description="Go back to checkout and choose a delivery address."
          actionLabel="Back to Checkout"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const meta = METHOD_META[paymentMethod];
  const MethodIcon = meta.icon;
  const total = totals?.total ?? 0;

  return (
    <View className="flex-1 bg-bg">
      <Header title="Payment" topInset={insets.top} />

      <View className="px-4">
        <View className="mb-4 flex-row items-start rounded-xl bg-primary/10 px-3 py-2.5">
          <FlaskConical size={16} color={colors.primary} />
          <Text className="ml-2 flex-1 text-xs font-semibold text-primary">
            Dev Payment Simulation - no real payment gateway is called and no money moves. This exists purely to exercise the
            order flow safely.
          </Text>
        </View>

        <Card className="mb-4 p-4">
          <View className="flex-row items-center">
            <MethodIcon size={20} color={colors.primary} />
            <Text className="ml-2 text-sm font-bold text-ink">{meta.label}</Text>
          </View>
          <View className="mt-3 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Amount Payable</Text>
            <Text className="text-xl font-bold text-ink">{formatCurrency(total)}</Text>
          </View>
        </Card>

        {deliveryInstructions ? (
          <Card className="mb-4 p-4">
            <Text className="text-xs font-semibold text-muted">Delivery Instructions for this order</Text>
            <Text className="mt-1 text-sm text-ink">{deliveryInstructions}</Text>
          </Card>
        ) : null}

        {restaurantClosed ? (
          <View className="mb-4 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
            <Clock size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">
              {restaurant.name} is currently closed and can't accept orders right now.
            </Text>
          </View>
        ) : null}

        {phase === "processing" ? (
          <Card className="mb-4 items-center p-6">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-3 text-sm font-semibold text-ink">Processing your payment…</Text>
            <Text className="mt-1 text-xs text-muted">Simulated - this will finish in a moment</Text>
          </Card>
        ) : null}

        {phase === "error" && errorMessage ? (
          <View className="mb-4 flex-row items-start rounded-xl bg-danger/10 px-3 py-2.5">
            <AlertTriangle size={16} color={colors.danger} />
            <Text className="ml-2 flex-1 text-sm font-semibold text-danger">{errorMessage}</Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <Button
            title="Retry Payment"
            size="lg"
            loading={isSubmitting}
            disabled={restaurantClosed}
            accessibilityLabel="Retry Payment"
            onPress={handleConfirm}
          />
        ) : (
          <Button
            title={
              restaurantClosed
                ? "Restaurant Closed"
                : paymentMethod === "cod"
                ? "Place Order (Cash on Delivery)"
                : `Pay ${formatCurrency(total)}`
            }
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting || restaurantClosed}
            accessibilityLabel={
              restaurantClosed
                ? "Restaurant closed, cannot pay"
                : paymentMethod === "cod"
                ? "Place order, cash on delivery"
                : `Pay ${formatCurrency(total)}`
            }
            onPress={handleConfirm}
          />
        )}
      </View>
    </View>
  );
}
