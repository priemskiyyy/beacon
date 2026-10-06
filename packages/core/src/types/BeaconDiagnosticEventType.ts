/**
 * What a diagnostic event records: a session change, a read of a running
 * fact, a check and the reads of its sources, the journal, a command taking or
 * leaving its slot, or a failure Beacon contained. Names describe observed
 * facts, so an accepted store handoff is never called an installation.
 *
 * @example
 * ```ts
 * const type: BeaconDiagnosticEventType = "session-started";
 * ```
 */
export type BeaconDiagnosticEventType =
  | "session-started"
  | "session-stopped"
  | "disposed"
  | "running-read"
  | "running-failed"
  | "check-started"
  | "route-failed"
  | "policy-failed"
  | "journal-read"
  | "journal-ignored"
  | "journal-failed"
  | "ready-reported"
  | "command-admitted"
  | "command-settled"
  | "read-started"
  | "read-accepted"
  | "read-renewed"
  | "read-failed"
  | "read-abandoned"
  | "late-callback"
  | "listener-error"
  | "cleanup-error";
