import type { BeaconDiagnosticEventType } from "@priemskiyyy/beacon";

import type { TimelineSource } from "example-shared/lab/types/TimelineSource";

export const TIMELINE_SOURCE_LABELS: Record<TimelineSource, string> = {
  diagnostic: "Beacon",
  transition: "Journal",
  world: "World",
};

export const DIAGNOSTIC_LABELS: Record<BeaconDiagnosticEventType, string> = {
  "session-started": "Session started",
  "session-stopped": "Session stopped",
  disposed: "Disposed",
  "running-read": "Read what runs",
  "running-failed": "Reading what runs failed",
  "check-requested": "Check requested",
  "route-failed": "Route failed",
  "policy-failed": "Support policy failed",
  "journal-read": "Journal read",
  "journal-ignored": "Journal record ignored",
  "journal-failed": "Journal failed",
  "ready-reported": "Ready reported",
  "command-admitted": "Command admitted",
  "command-settled": "Command settled",
  "read-started": "Read started",
  "read-accepted": "Read accepted",
  "read-renewed": "Read renewed the held decision",
  "read-failed": "Read failed",
  "read-abandoned": "Read abandoned",
  "late-callback": "Late callback dropped",
  "listener-error": "Listener error contained",
  "cleanup-error": "Cleanup error contained",
};
