import type { BeaconDiagnosticCounters } from "src/types/BeaconDiagnosticCounters";
import type { BeaconDiagnosticSnapshot } from "src/types/BeaconDiagnosticSnapshot";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";

/** The counter each event type raises, or `null` when it only appears as an event. */
export const COUNTED_EVENTS = {
  "session-started": null,
  "session-stopped": null,
  disposed: null,
  "running-read": null,
  "running-failed": null,
  "check-started": null,
  "route-failed": null,
  "policy-failed": null,
  "journal-read": null,
  "journal-ignored": null,
  "journal-failed": null,
  "ready-reported": null,
  "command-admitted": null,
  "command-settled": null,
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

/** What the diagnostics say before any session: nothing has happened, and nothing was counted. */
export const INITIAL_DIAGNOSTICS: BeaconDiagnosticSnapshot = Object.freeze({
  status: "idle",
  session: null,
  counters: Object.freeze({
    lateCallbacks: 0,
    listenerErrors: 0,
    cleanupErrors: 0,
  }),
});
