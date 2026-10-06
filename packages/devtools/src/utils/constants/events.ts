import type { BeaconDiagnosticEventType } from "@priemskiyyy/beacon";

/**
 * Whether each event type means something went wrong: a failure lights the
 * launcher red while the panel is closed. Every type is decided here, so a new
 * one in Beacon does not compile until someone says which it is.
 */
export const EVENT_FAILURES = {
  "session-started": false,
  "session-stopped": false,
  disposed: false,
  "running-read": false,
  "running-failed": true,
  "check-requested": false,
  "route-failed": true,
  "policy-failed": true,
  "journal-read": false,
  "journal-ignored": false,
  "journal-failed": true,
  "ready-reported": false,
  "command-admitted": false,
  "command-settled": false,
  "read-started": false,
  "read-accepted": false,
  "read-renewed": false,
  "read-failed": true,
  "read-abandoned": false,
  "late-callback": true,
  "listener-error": true,
  "cleanup-error": true,
} satisfies Record<BeaconDiagnosticEventType, boolean>;
