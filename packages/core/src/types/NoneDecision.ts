/**
 * An authority's explicit statement that it has no release for a scope. A
 * missing decision, an empty response or a failed read is never this.
 *
 * @example
 * ```ts
 * const decision: NoneDecision = { kind: "none", reason: "up-to-date" };
 * ```
 */
export type NoneDecision = {
  kind: "none";
  /** A short machine-readable code from the authority. */
  reason: string;
};
