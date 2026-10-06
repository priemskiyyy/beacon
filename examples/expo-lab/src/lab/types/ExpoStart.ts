import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import type { EventLog } from "example-shared/types/EventLog";
import type { NativeBeacon } from "src/lab/types/NativeBeacon";

/**
 * What a platform file starts. The web build runs the scripted lab; a device
 * runs a real Beacon over Expo Updates, which has other routes, so the two are
 * not one registered Beacon type.
 */
export type ExpoStart =
  | { kind: "lab"; lab: ReleaseLab; runtime: string }
  | {
      kind: "native";
      beacon: NativeBeacon;
      diagnostics: EventLog<BeaconDiagnosticEvent>;
      runtime: string;
    };
