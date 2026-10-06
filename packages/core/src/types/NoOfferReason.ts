/**
 * Why a check that succeeded has nothing to offer.
 *
 * - `no-decision`: the authority said it has no release for this scope.
 * - `same-identity`: the offered release is the one running.
 * - `equal-order`: the candidate orders equal to what is running.
 * - `equal-order-different-identity`: it orders equal but is another release,
 *   which only a target route can offer.
 * - `older-than-current`: the candidate orders below what is running.
 * - `not-admitted`: the version strategy does not admit the candidate, such as
 *   a prerelease.
 * - `incompatible`: the release cannot run where it would be installed.
 *
 * @example
 * ```ts
 * const reason: NoOfferReason = "older-than-current";
 * ```
 */
export type NoOfferReason =
  | "no-decision"
  | "same-identity"
  | "equal-order"
  | "equal-order-different-identity"
  | "older-than-current"
  | "not-admitted"
  | "incompatible";
