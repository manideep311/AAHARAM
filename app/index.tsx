import { Text, View } from "react-native";

import { BRAND_NAME } from "../constants/brand";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="text-ink">{BRAND_NAME}</Text>
    </View>
  );
}
