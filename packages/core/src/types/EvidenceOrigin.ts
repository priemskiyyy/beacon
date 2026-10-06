/**
 * Where a piece of evidence came from: a release source read over the network,
 * or a provider SDK.
 *
 * @example
 * ```ts
 * const origin: EvidenceOrigin = "network";
 * ```
 */
export type EvidenceOrigin = "network" | "provider";
