/**
 * What the next state says about an earlier intent. None of them is a
 * causal or a crash-free claim.
 *
 * - `same-boot`: no new boot yet, so the action may still be unresolved.
 * - `target-running`: a new boot runs the comparable target it aimed at.
 * - `target-not-running`: a new boot runs what ran before, so the target was
 *   not reached, for a reason this cannot tell.
 * - `different-target`: a new boot runs something else than it aimed at, and
 *   its actual identity is kept.
 * - `inconclusive`: an identity is unknown or incomparable, which is neither
 *   success nor failure.
 *
 * @example
 * ```ts
 * const outcome: ReconciliationOutcome = "target-not-running";
 * ```
 */
export type ReconciliationOutcome =
  | "same-boot"
  | "target-running"
  | "target-not-running"
  | "different-target"
  | "inconclusive";
