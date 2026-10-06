import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { ErasedPolicy } from "src/types/internal/ErasedPolicy";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningApplication } from "src/types/RunningApplication";
import type { Listeners } from "src/utils/internal/observable/Listeners";

/** What the route registry is built from. */
export type RouteRegistryOptions = {
  definitions: Record<string, RouteDefinition>;
  /** `null` when the Beacon has no support policy. */
  policy: ErasedPolicy | null;
  getScope: () => ReleaseScope;
  running: ObservableValue<RunningApplication>;
  clock: BeaconClock;
  timeout: number;
  createListeners: () => Listeners;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
