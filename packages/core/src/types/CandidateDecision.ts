import type { Release } from "src/types/Release";

/**
 * An authority's statement that a release exists, with the order value its
 * version strategy compares. It becomes an offer only when it is newer than
 * what is running.
 *
 * @example
 * ```ts
 * const decision: CandidateDecision<string> = {
 *   kind: "candidate",
 *   release: { identity, order: "2.5.0" },
 * };
 * ```
 */
export type CandidateDecision<
  TOrder,
  TMetadata extends object | null = null,
> = {
  kind: "candidate";
  release: Release<TMetadata> & { order: TOrder };
};
