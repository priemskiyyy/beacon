import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import * as Application from "expo-application";
import keyValueStore from "expo-sqlite/kv-store";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { TIMELINE_LENGTH } from "example-shared/lab/constants/lab";
import { createEventLog } from "example-shared/utils/createEventLog";
import { createJournalStorage } from "src/lab/createJournalStorage";
import { createNativeBeacon } from "src/lab/createNativeBeacon";
import type { ExpoStart } from "src/lab/types/ExpoStart";

const { major, minor, patch } = Platform.constants.reactNativeVersion;

// Minted once per JavaScript runtime, which is what a boot is; `crypto.randomUUID` is not there on every engine.
const createBootId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** The device runs a real Beacon over Expo Updates; the platform file, not a runtime check, picks it. */
export const startLab = (): ExpoStart => {
  const beacon = createNativeBeacon({
    updates: Updates,
    platform: Platform.OS,
    boot: { id: createBootId() },
    // A reload replaces this runtime, so what it asked for is recorded in storage that survives it.
    journal: createJournalStorage(keyValueStore),
    application: Application,
  });

  const { log, add } = createEventLog<BeaconDiagnosticEvent>(TIMELINE_LENGTH);

  beacon.diagnostics.events.subscribe(add);

  return {
    kind: "native",
    beacon,
    diagnostics: log,
    runtime: `${Platform.OS} ${Platform.Version}, React Native ${major}.${minor}.${patch}`,
  };
};
