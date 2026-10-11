import { useRef, useState } from "react";
import { View, Text, FlatList, Pressable, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Compass, MapPin, Truck, Sparkles, LucideIcon } from "lucide-react-native";
import { Button } from "../../components/ui/Button";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Slide {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    key: "discover",
    icon: Compass,
    title: "Discover food",
    description: "Explore a world of cuisines and dishes curated just for you.",
  },
  {
    key: "nearby",
    icon: MapPin,
    title: "Find nearby restaurants",
    description: "See what's cooking close to you, ranked by distance and rating.",
  },
  {
    key: "track",
    icon: Truck,
    title: "Track deliveries",
    description: "Watch your order move from kitchen to doorstep in real time.",
  },
  {
    key: "personalized",
    icon: Sparkles,
    title: "Personalized recommendations",
    description: "Get suggestions tailored to your taste, every time you open the app.",
  },
];

async function finishOnboarding() {
  await AsyncStorage.setItem("crave:onboarding-seen", "true");
  router.replace("/auth/login");
}

export default function Onboarding() {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const isLast = activeIndex === SLIDES.length - 1;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== activeIndex) setActiveIndex(index);
  }

  function onGetStarted() {
    if (isLast) {
      finishOnboarding();
    } else {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row justify-end px-5 pt-4">
        <Pressable onPress={finishOnboarding} accessibilityRole="button" hitSlop={8}>
          <Text className="text-muted font-medium">Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }} className="items-center justify-center px-8">
            <View className="bg-primary/10 rounded-full p-8 mb-8">
              <item.icon size={56} color="#FF5A36" />
            </View>
            <Text className="text-2xl font-bold text-ink text-center mb-3">{item.title}</Text>
            <Text className="text-base text-muted text-center">{item.description}</Text>
          </View>
        )}
      />

      <View className="flex-row justify-center items-center mb-6">
        {SLIDES.map((slide, index) => (
          <View
            key={slide.key}
            className={`mx-1 rounded-full ${index === activeIndex ? "bg-primary w-2.5 h-2.5" : "bg-border w-2 h-2"}`}
          />
        ))}
      </View>

      <View className="px-6 pb-8">
        <Button title={isLast ? "Get Started" : "Next"} onPress={onGetStarted} size="lg" />
      </View>
    </View>
  );
}
