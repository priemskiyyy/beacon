import type { Release } from "src/types/Release";

/**
 * An authority's statement that a scope should run one release, whatever its
 * order: the way to express a rollback or a redeployment.
 *
 * @example
 * ```ts
 * const decision: TargetDecision = { kind: "target", release };
 * ```
 */
export type TargetDecision<TMetadata extends object | null = null> = {
  kind: "target";
  release: Release<TMetadata>;
};
