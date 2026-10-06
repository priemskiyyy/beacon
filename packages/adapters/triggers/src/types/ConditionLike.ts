/**
 * A requirement that is met, unmet or unknown, which a Reach condition
 * satisfies. `subscribe` never calls back at once.
 *
 * @example
 * ```ts
 * declare const connected: ConditionLike;
 *
 * const back = reachReconnect({ condition: connected });
 * ```
 */
export type ConditionLike = {
  get(): { status: "met" | "unmet" | "unknown" };
  subscribe(listener: () => void): () => void;
};
