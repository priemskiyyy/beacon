import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RunningApplication } from "src/types/RunningApplication";
import type { Transaction } from "src/utils/internal/observable/Transaction";

/** What the routes of one kind are built from. */
export type RouteGroupOptions = {
  clock: BeaconClock;
  timeout: number;
  getScope: () => ReleaseScope;
  running: ObservableValue<RunningApplication>;
  /** Applies a change to the routes, the support policy and the root in one commit. */
  commit: (apply: (transaction: Transaction) => void) => void;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
