import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";

export function Skeleton({ width, height, radius = 8 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: "#F0E7E0" }, style]} />;
}
