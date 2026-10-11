import React, { useState } from "react";
import { Image, View, ImageProps } from "react-native";
import { ImageOff } from "lucide-react-native";

export function ImageWithFallback({ uri, className, style }: { uri: string; className?: string; style?: ImageProps["style"] }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View className={`bg-border items-center justify-center ${className ?? ""}`} style={style}>
        <ImageOff size={24} color="#777777" />
      </View>
    );
  }

  return <Image source={{ uri }} className={className} style={style} onError={() => setFailed(true)} resizeMode="cover" />;
}
