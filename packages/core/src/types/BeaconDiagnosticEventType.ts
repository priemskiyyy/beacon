/**
 * What a diagnostic event records: a session change, a read of a running
 * fact, or a failure Beacon contained. Names describe observed facts, so an
 * accepted store handoff is never called an installation.
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
  | "source-read-started"
  | "source-read-accepted"
  | "source-read-renewed"
  | "source-read-failed"
  | "source-read-abandoned"
  | "late-callback"
  | "listener-error"
  | "cleanup-error";
