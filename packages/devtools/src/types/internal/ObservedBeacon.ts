import type {
  BeaconDiagnostics,
  BeaconStatus,
  CheckOptions,
  ObservableValue,
  RunningApplication,
  SupportState,
  TransitionState,
} from "@priemskiyyy/beacon";

import type { ObservedRoute } from "src/types/internal/ObservedRoute";

// Written out rather than picked from Beacon, whose route registry is a type parameter, so a Beacon typed by its own routes fits.
// `route` is a method so that a name typed by its own routes is accepted as the string it is.
export type ObservedBeacon = {
  status: ObservableValue<BeaconStatus>;
  routeNames: string[];
  running: ObservableValue<RunningApplication>;
  support: ObservableValue<SupportState>;
  transitions: ObservableValue<TransitionState>;
  diagnostics: BeaconDiagnostics;
  route(name: string): ObservedRoute;
  check(options?: CheckOptions): Promise<unknown>;
};
