// @ts-expect-error - global.css has no type declarations; this is a CSS side-effect import for NativeWind
import "../global.css";

import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
