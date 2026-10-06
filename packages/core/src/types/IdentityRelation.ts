/**
 * How two release identities relate: the same release, different releases of
 * one authority and domain, or not comparable at all.
 *
 * @example
 * ```ts
 * const relation: IdentityRelation = compareIdentities(
 *   BUILD_IDENTITY,
 *   observation.offer.release.identity,
 * );
 * ```
 */
export type IdentityRelation = "same" | "different" | "incomparable";
