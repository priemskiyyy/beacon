import type { BeaconStatus } from "src/types/BeaconStatus";

/** No session has been started yet. */
export const IDLE_STATUS: BeaconStatus = Object.freeze({ state: "idle" });

/** The last session was stopped and may be started again. */
export const STOPPED_STATUS: BeaconStatus = Object.freeze({ state: "stopped" });

/** The Beacon ended for good. */
export const DISPOSED_STATUS: BeaconStatus = Object.freeze({
  state: "disposed",
});
