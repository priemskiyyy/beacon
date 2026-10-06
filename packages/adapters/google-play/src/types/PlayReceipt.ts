/**
 * What an accepted Play command proves, and no more. A downloaded update is
 * prepared, not installed; a started immediate flow is Play's own UI taking
 * over, with no promise that JavaScript keeps running; a completion request
 * is the native call made, and the restart belongs to Play.
 *
 * @example
 * ```ts
 * const receipt: PlayReceipt = { kind: "update-downloaded" };
 * ```
 */
export type PlayReceipt =
  | { kind: "update-downloaded" }
  | { kind: "immediate-flow-started" }
  | { kind: "completion-requested" };
