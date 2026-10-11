import { Tabs } from "expo-router";
import { Home, Compass, ReceiptText, Heart, User } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF5A36",
        tabBarInactiveTintColor: "#777777",
        tabBarStyle: { borderTopColor: "#F0E7E0" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites", tabBarIcon: ({ color, size }) => <Heart color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
