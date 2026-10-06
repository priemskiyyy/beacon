import type { CheckState } from "src/types/CheckState";
import type { OperationState } from "src/types/OperationState";

/** No check has been attempted in this route yet. */
export const IDLE_CHECK: CheckState = Object.freeze({ state: "idle" });

/** No command is being carried out. */
export const IDLE_OPERATION: OperationState = Object.freeze({ state: "idle" });

/** Why a driver route stays closed when another session holds the native manager it needs. */
export const MANAGER_HELD_MESSAGE =
  "The provider is not open: its native module is held by another Beacon session (a second Beacon, or Fast Refresh). Stop the first, or start only through BeaconProvider.";

/** Why a driver route stays closed when the provider threw while it opened. */
export const OPEN_FAILED_MESSAGE =
  "The provider is not open: it threw while it opened. The cause is on the route-failed event of beacon.diagnostics.events.";
