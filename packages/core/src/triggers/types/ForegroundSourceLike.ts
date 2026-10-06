/**
 * What `pulseForeground` listens to: a Pulse satisfies it. A `foreground` event
 * says how long the app was away, in milliseconds, or `null` where that was
 * not observed.
 *
 * @example
 * ```ts
 * declare const pulse: ForegroundSourceLike;
 *
 * const returns = pulseForeground({ source: pulse, minAway: 30_000 });
 * ```
 */
export type ForegroundSourceLike = {
  on(
    type: "foreground",
    listener: (event: { observedAway: number | null }) => void,
  ): () => void;
  on(type: "background", listener: () => void): () => void;
};
