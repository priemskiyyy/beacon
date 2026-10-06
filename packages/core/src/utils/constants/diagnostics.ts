import type { BeaconDiagnosticCounters } from "src/types/BeaconDiagnosticCounters";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";

/** The counter each event type raises, or `null` when it only appears as an event. */
export const COUNTED_EVENTS = {
  "session-started": null,
  "session-stopped": null,
  disposed: null,
  "running-read": null,
  "running-failed": null,
  "check-requested": null,
  "route-failed": null,
  "read-started": null,
  "read-accepted": null,
  "read-renewed": null,
  "read-failed": null,
  "read-abandoned": null,
  "late-callback": "lateCallbacks",
  "listener-error": "listenerErrors",
  "cleanup-error": "cleanupErrors",
} satisfies Record<
  BeaconDiagnosticEventType,
  keyof BeaconDiagnosticCounters | null
>;
