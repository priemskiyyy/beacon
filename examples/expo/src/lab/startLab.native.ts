import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { TIMELINE_LENGTH } from "example-shared/lab/constants/lab";
import { createEventLog } from "example-shared/utils/createEventLog";
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
