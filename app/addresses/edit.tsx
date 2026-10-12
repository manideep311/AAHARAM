import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react-native";
import { getAddresses, saveAddress } from "../../services/addresses";
import { addressSchema, AddressFormValues } from "../../lib/validation/schemas";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { colors } from "../../constants/theme";

const LABELS: AddressFormValues["label"][] = ["Home", "Work", "Other"];

const DEFAULT_VALUES: AddressFormValues = {
  label: "Home",
  recipientName: "",
  phone: "",
  line1: "",
  area: "",
  city: "",
  state: "",
  postalCode: "",
  landmark: "",
  instructions: "",
};

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

export default function AddressEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const existingId = params.id;
  const isEditing = !!existingId;

  const queryClient = useQueryClient();
  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const existingAddress = addressesQuery.data?.find((a) => a.id === existingId);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Prefill the form once the existing address loads (edit mode only); runs again if the
  // underlying data refetches with a different value.
  useEffect(() => {
    if (existingAddress) {
      reset({
        label: existingAddress.label,
        recipientName: existingAddress.recipientName,
        phone: existingAddress.phone,
        line1: existingAddress.line1,
        area: existingAddress.area,
        city: existingAddress.city,
        state: existingAddress.state,
        postalCode: existingAddress.postalCode,
        landmark: existingAddress.landmark ?? "",
        instructions: existingAddress.instructions ?? "",
      });
    }
  }, [existingAddress, reset]);

  const selectedLabel = watch("label");

  async function onSubmit(values: AddressFormValues) {
    setSaving(true);
    setSaveError(null);
    const isFirstAddress = !isEditing && (addressesQuery.data?.length ?? 0) === 0;
    try {
      await saveAddress({
        id: existingId ?? "",
        label: values.label,
        recipientName: values.recipientName,
        phone: values.phone,
        line1: values.line1,
        area: values.area,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,
        landmark: values.landmark?.trim() ? values.landmark : undefined,
        instructions: values.instructions?.trim() ? values.instructions : undefined,
        isDefault: existingAddress?.isDefault ?? isFirstAddress,
      });
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      router.back();
    } catch (e) {
      // Saving now goes over the network, so it can fail; keep the form filled in for a retry.
      setSaveError(e instanceof Error ? e.message : "Couldn't save this address. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && addressesQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Header title="Edit Address" topInset={insets.top} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title={isEditing ? "Edit Address" : "Add New Address"} topInset={insets.top} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32 }}>
        <Text className="mb-1.5 text-sm font-medium text-ink">Label</Text>
        <View className="mb-4 flex-row">
          {LABELS.map((label) => {
            const isActive = selectedLabel === label;
            return (
              <Pressable
                key={label}
                onPress={() => setValue("label", label)}
                accessibilityRole="button"
                accessibilityLabel={`Label as ${label}`}
                className={`mr-2 rounded-full border px-4 py-2 ${isActive ? "border-primary bg-primary" : "border-border bg-card"}`}
              >
                <Text className={`text-sm font-semibold ${isActive ? "text-white" : "text-ink"}`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Controller
          control={control}
          name="recipientName"
          render={({ field }) => (
            <TextField
              label="Recipient Name"
              placeholder="Full name"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.recipientName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              label="Phone Number"
              placeholder="10-digit mobile number"
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="line1"
          render={({ field }) => (
            <TextField
              label="House / Flat / Building"
              placeholder="e.g. Flat 302, Palm Residency"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.line1?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="area"
          render={({ field }) => (
            <TextField
              label="Area / Street"
              placeholder="e.g. Koramangala 5th Block"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.area?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <TextField label="City" placeholder="e.g. Bengaluru" value={field.value} onChangeText={field.onChange} error={errors.city?.message} />
          )}
        />

        <Controller
          control={control}
          name="state"
          render={({ field }) => (
            <TextField label="State" placeholder="e.g. Karnataka" value={field.value} onChangeText={field.onChange} error={errors.state?.message} />
          )}
        />

        <Controller
          control={control}
          name="postalCode"
          render={({ field }) => (
            <TextField
              label="PIN Code"
              placeholder="6-digit PIN code"
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="number-pad"
              maxLength={6}
              error={errors.postalCode?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="landmark"
          render={({ field }) => (
            <TextField
              label="Landmark (optional)"
              placeholder="e.g. Near Forum Mall"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.landmark?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="instructions"
          render={({ field }) => (
            <TextField
              label="Delivery Instructions (optional)"
              placeholder="e.g. Leave with security guard"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={140}
              multiline
              error={errors.instructions?.message}
            />
          )}
        />

        <Button title="Save Address" onPress={handleSubmit(onSubmit)} loading={saving} accessibilityLabel="Save Address" />
        {saveError ? <Text className="mt-2 text-xs text-danger">{saveError}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
