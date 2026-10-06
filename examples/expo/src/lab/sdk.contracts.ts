import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import { expoApplication } from "@priemskiyyy/beacon-expo";
import { foreground } from "@priemskiyyy/beacon-triggers";
import * as Application from "expo-application";
import keyValueStore from "expo-sqlite/kv-store";
import { AppState } from "react-native";

// The real modules of Expo SDK 57 and React Native 0.86 fit what the recipes ask of them, as the application passes them in.
export const storage = keyValueJournalStorage(keyValueStore);

export const reader = expoApplication({ application: Application });

// The real `AppState` of React Native 0.86 fits the trigger that keeps the rule of the return.
export const returns = foreground({ appState: AppState });

// A module that is not `AppState` does not fit the trigger.
// @ts-expect-error the trigger needs `currentState` and `addEventListener`.
foreground({ appState: keyValueStore });
