import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface LocationState {
  label: string | null;
  setLabel: (label: string) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      label: null,
      setLabel: (label) => set({ label }),
    }),
    { name: "crave:location", storage: createJSONStorage(() => AsyncStorage) }
  )
);
