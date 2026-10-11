import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Preferences {
  vegOnly: boolean;
  favoriteCuisines: string[];
  budgetPerMeal: number | null; // INR, null = no preference
}

interface PreferencesState {
  preferences: Preferences;
  setPreferences: (next: Partial<Preferences>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: { vegOnly: false, favoriteCuisines: [], budgetPerMeal: null },
      setPreferences: (next) => set({ preferences: { ...get().preferences, ...next } }),
    }),
    { name: "crave:preferences", storage: createJSONStorage(() => AsyncStorage) }
  )
);
