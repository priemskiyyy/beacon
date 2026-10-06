/**
 * Why a support status is unknown when Beacon reached that itself: no policy
 * is configured, none was accepted yet, the accepted one lapsed, or it could
 * not be evaluated. An unknown the policy answered has none of these, and its
 * own reasons in the evaluation.
 *
 * @example
 * ```ts
 * const reason: SupportUnknownReason = "expired";
 * ```
 */
export type SupportUnknownReason =
  "no-policy" | "not-checked" | "expired" | "evaluation-failed";
