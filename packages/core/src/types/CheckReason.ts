/**
 * Why a check was requested, for diagnostics. It never changes what the check
 * does: there is no `force` that promises fresher data than the platform can
 * give.
 *
 * @example
 * ```ts
 * await beacon.check({ reason: "foreground" });
 * ```
 */
export type CheckReason =
  /** The first check of a session. */
  | "startup"
  /** A check the application made on its own, such as a button. */
  | "manual"
  /** The application returned to the foreground. */
  | "foreground"
  /** The network came back. */
  | "reconnect"
  /** A source said something changed, such as a push. */
  | "invalidation"
  /** A timer asked again without knowing anything changed. */
  | "interval"
  /** A check that follows a failed one, after a wait. */
  | "retry"
  /** A recheck because the evidence of a route expired. */
  | "expiry";
