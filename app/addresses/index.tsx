import React from "react";
import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, MapPin, Pencil, Trash2, Check } from "lucide-react-native";
import { getAddresses, saveAddress, deleteAddress } from "../../services/addresses";
import { useCheckoutSelectionStore } from "../../store/checkout-selection-store";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { Address } from "../../types/domain";
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

function addressLines(address: Address): string {
  const parts = [address.line1, address.area, `${address.city}, ${address.state} ${address.postalCode}`];
  return parts.filter(Boolean).join(", ");
}

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selectMode?: string }>();
  const selectMode = params.selectMode === "true";

  const setSelectedAddressId = useCheckoutSelectionStore((s) => s.setSelectedAddressId);
  const selectedAddressId = useCheckoutSelectionStore((s) => s.selectedAddressId);

  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const addresses = addressesQuery.data ?? [];

  function handleSelect(address: Address) {
    setSelectedAddressId(address.id);
    router.back();
  }

  function handleSetDefault(address: Address) {
    if (address.isDefault) return;
    saveAddress({ ...address, isDefault: true }).then(() => addressesQuery.refetch());
  }

  function handleDelete(address: Address) {
    Alert.alert("Delete address?", `Remove "${address.label}" address? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteAddress(address.id).then(() => addressesQuery.refetch());
        },
      },
    ]);
  }

  function renderCard(address: Address) {
    if (selectMode) {
      const isSelected = address.id === selectedAddressId;
      return (
        <Pressable
          onPress={() => handleSelect(address)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${address.label} address`}
        >
          <Card className={`mb-3 p-4 ${isSelected ? "bg-primary/5" : ""}`}>
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center">
                  <Badge label={address.label} />
                  {address.isDefault ? <View className="ml-2"><Badge label="Default" tone="success" /></View> : null}
                </View>
                <Text className="mt-2 text-sm font-semibold text-ink">{address.recipientName}</Text>
                <Text className="mt-1 text-sm text-muted">{addressLines(address)}</Text>
                {address.landmark ? <Text className="mt-1 text-xs text-muted">Landmark: {address.landmark}</Text> : null}
              </View>
              {isSelected ? (
                <View className="rounded-full bg-primary p-1">
                  <Check size={16} color="#fff" />
                </View>
              ) : null}
            </View>
          </Card>
        </Pressable>
      );
    }

    return (
      <Card className="mb-3 p-4">
        <View className="flex-row items-center">
          <Badge label={address.label} />
          {address.isDefault ? <View className="ml-2"><Badge label="Default" tone="success" /></View> : null}
        </View>
        <Text className="mt-2 text-sm font-semibold text-ink">{address.recipientName}</Text>
        <Text className="mt-0.5 text-sm text-muted">{address.phone}</Text>
        <Text className="mt-1 text-sm text-muted">{addressLines(address)}</Text>
        {address.landmark ? <Text className="mt-1 text-xs text-muted">Landmark: {address.landmark}</Text> : null}
        {address.instructions ? <Text className="mt-1 text-xs italic text-muted">Note: {address.instructions}</Text> : null}

        <View className="mt-3 flex-row items-center">
          {!address.isDefault ? (
            <Pressable
              onPress={() => handleSetDefault(address)}
              accessibilityRole="button"
              accessibilityLabel={`Set ${address.label} as default`}
              hitSlop={6}
              className="mr-4"
            >
              <Text className="text-sm font-semibold text-primary">Set as Default</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push(`/addresses/edit?id=${address.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${address.label} address`}
            hitSlop={6}
            className="mr-4 flex-row items-center"
          >
            <Pencil size={14} color={colors.ink} />
            <Text className="ml-1 text-sm font-semibold text-ink">Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDelete(address)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${address.label} address`}
            hitSlop={6}
            className="flex-row items-center"
          >
            <Trash2 size={14} color={colors.danger} />
            <Text className="ml-1 text-sm font-semibold text-danger">Delete</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <Header title={selectMode ? "Select Delivery Address" : "Saved Addresses"} topInset={insets.top} />

      {addressesQuery.isLoading ? (
        <View className="px-4 py-2">
          <Skeleton width="100%" height={120} />
          <View className="mt-3">
            <Skeleton width="100%" height={120} />
          </View>
        </View>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add an address to get your food delivered."
          actionLabel="Add New Address"
          onAction={() => router.push("/addresses/edit")}
        />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(address) => address.id}
          renderItem={({ item }) => renderCard(item)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 100 }}
        />
      )}

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          title="Add New Address"
          variant="outline"
          onPress={() => router.push("/addresses/edit")}
          accessibilityLabel="Add New Address"
        />
      </View>
    </View>
  );
}
