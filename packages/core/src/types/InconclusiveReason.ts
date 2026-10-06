/**
 * Why a check that succeeded cannot say whether a release is on offer. It is
 * never read as up to date.
 *
 * - `missing-current-identity`: what is running has no known identity.
 * - `missing-current-order`: what is running has no order to compare.
 * - `incomparable-identity`: the two identities belong to different
 *   authorities or domains.
 * - `incomparable-order`: the version strategy could not order the two values.
 *
 * @example
 * ```ts
 * const reason: InconclusiveReason = "missing-current-identity";
 * ```
 */
export type InconclusiveReason =
  | "missing-current-identity"
  | "missing-current-order"
  | "incomparable-identity"
  | "incomparable-order";
