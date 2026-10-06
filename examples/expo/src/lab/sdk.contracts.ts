import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
import keyValueStore from "expo-sqlite/kv-store";
import { AppState } from "react-native";

import { checkOnForeground } from "src/lab/checkOnForeground";

// The real modules of Expo SDK 57 and React Native 0.86 fit what the recipes ask of them, as the application passes them in.
export const storage = keyValueJournalStorage(keyValueStore);

export const reader = expoApplication({
  application: Application,
  platform: "android",
  authority: "dev.beacon.example",
});

export const stop = checkOnForeground({ check: async () => {} }, AppState);

// A check that asks for another reason than the foreground is not what the recipe calls.
checkOnForeground(
  {
    // @ts-expect-error the recipe asks for the foreground reason only.
    check: async (options: { reason: "manual" }) => options,
  },
  AppState,
);
