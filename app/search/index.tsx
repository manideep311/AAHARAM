import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Search as SearchIcon, X, Clock, SearchX } from "lucide-react-native";
import { searchAll } from "../../services/search";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { HorizontalCarousel } from "../../components/home/HorizontalCarousel";
import { RestaurantCard } from "../../components/home/RestaurantCard";
import { FoodCard } from "../../components/home/FoodCard";
import { colors } from "../../constants/theme";

const RECENT_SEARCHES_KEY = "aaharam:recent-searches";
const MAX_RECENT_SEARCHES = 8;
const DEBOUNCE_MS = 300;

const SUGGESTED_SEARCHES = ["Biryani", "Pizza near me", "Vegetarian under ₹200", "Highly rated"];

async function loadRecentSearches(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRecentSearches(list: string[]): Promise<void> {
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cuisine?: string }>();

  const [query, setQuery] = useState(() => params.cuisine ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const trimmedDebounced = debouncedQuery.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["search", trimmedDebounced],
    queryFn: () => searchAll(trimmedDebounced),
    enabled: trimmedDebounced.length > 0,
  });

  const addRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const deduped = prev.filter((t) => t.toLowerCase() !== term.toLowerCase());
      const next = [term, ...deduped].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  // Every time a debounced search actually runs, record it as a recent search.
  useEffect(() => {
    if (trimmedDebounced.length > 0) {
      addRecentSearch(trimmedDebounced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedDebounced]);

  const isIdle = query.trim().length === 0;
  const isAwaitingDebounce = !isIdle && query !== debouncedQuery;
  const restaurants = data?.restaurants ?? [];
  const items = data?.items ?? [];
  const hasResults = restaurants.length > 0 || items.length > 0;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 pt-3 pb-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="mr-2">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1 flex-row items-center bg-card border border-border rounded-2xl px-4 py-2.5">
          <SearchIcon size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search biryani, pizza, restaurants..."
            placeholderTextColor={colors.muted}
            autoFocus
            returnKeyType="search"
            className="flex-1 text-base text-ink ml-2"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <X size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isIdle ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {recentSearches.length > 0 ? (
            <>
              <SectionHeader title="Recent Searches" />
              <View className="flex-row flex-wrap px-4">
                {recentSearches.map((term) => (
                  <View
                    key={term}
                    className="flex-row items-center bg-border/50 rounded-full pl-3 pr-2 py-1.5 mr-2 mb-2"
                  >
                    <Pressable onPress={() => setQuery(term)} accessibilityRole="button">
                      <View className="flex-row items-center">
                        <Clock size={12} color={colors.muted} />
                        <Text className="text-sm text-ink ml-1.5">{term}</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => removeRecentSearch(term)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${term} from recent searches`}
                      hitSlop={8}
                      className="ml-2"
                    >
                      <X size={14} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <SectionHeader title="Suggested Searches" />
          <View className="flex-row flex-wrap px-4">
            {SUGGESTED_SEARCHES.map((term) => (
              <Pressable
                key={term}
                onPress={() => setQuery(term)}
                accessibilityRole="button"
                className="bg-primary/10 rounded-full px-3.5 py-2 mr-2 mb-2"
              >
                <Text className="text-sm font-medium text-primary">{term}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : isAwaitingDebounce || isFetching ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted text-sm">Searching...</Text>
        </View>
      ) : hasResults ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {restaurants.length > 0 ? (
            <>
              <SectionHeader title="Restaurants" />
              <HorizontalCarousel
                data={restaurants}
                keyExtractor={(r) => r.id}
                renderItem={({ item }) => <RestaurantCard restaurant={item} />}
              />
            </>
          ) : null}
          {items.length > 0 ? (
            <>
              <SectionHeader title="Dishes" />
              <HorizontalCarousel
                data={items}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => <FoodCard item={item} />}
              />
            </>
          ) : null}
        </ScrollView>
      ) : (
        <EmptyState icon={SearchX} title={`No results for "${trimmedDebounced}"`} description="Try a different search term." />
      )}
    </View>
  );
}
