/**
 * Where a piece of evidence came from: a source read over the network, a
 * provider SDK, the application itself, or a persisted record.
 *
 * @example
 * ```ts
 * const origin: EvidenceOrigin = "network";
 * ```
 */
export type EvidenceOrigin =
  "network" | "provider" | "application" | "persisted";
