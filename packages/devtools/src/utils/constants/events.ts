import type { BeaconDiagnosticEventType } from "@priemskiyyy/beacon";

/** The events that mean something went wrong: each lights the launcher red while the panel is closed. */
export const FAILURE_EVENT_TYPES: BeaconDiagnosticEventType[] = [
  "route-failed",
  "policy-failed",
  "journal-failed",
  "running-failed",
  "read-failed",
  "listener-error",
  "cleanup-error",
  "late-callback",
];
