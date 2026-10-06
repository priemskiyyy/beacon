/**
 * Why a command refused a reference.
 *
 * - `foreign`: Beacon did not mint this reference, or it belongs to another
 *   route; a copy or a forgery is refused.
 * - `replaced`: it is no longer the route's current offer or prepared target.
 * - `expired`: the evidence behind it no longer holds.
 * - `provider-changed`: the provider no longer has that target.
 *
 * @example
 * ```ts
 * const reason: StaleReason = "replaced";
 * ```
 */
export type StaleReason =
  "foreign" | "replaced" | "expired" | "provider-changed";
