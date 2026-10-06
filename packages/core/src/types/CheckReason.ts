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
  | "startup"
  | "manual"
  | "foreground"
  | "reconnect"
  | "invalidation"
  | "interval";
