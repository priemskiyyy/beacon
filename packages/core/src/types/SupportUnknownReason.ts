/**
 * Why a support status is unknown when Beacon reached that itself: no policy
 * is configured, no check has run, the last read of the policy's source failed
 * and nothing is in force, the accepted one lapsed, or it could not be
 * evaluated. An unknown the policy answered has none of these, and its own
 * reasons in the evaluation.
 *
 * @example
 * ```ts
 * const reason: SupportUnknownReason = "expired";
 * ```
 */
export type SupportUnknownReason =
  "no-policy" | "not-checked" | "read-failed" | "expired" | "evaluation-failed";
