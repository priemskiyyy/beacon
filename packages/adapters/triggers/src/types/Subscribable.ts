/**
 * Anything that only says "look again": a push channel, another tab, a value
 * that changed. Its payload is never read.
 *
 * @example
 * ```ts
 * const channel: Subscribable = {
 *   subscribe: (listener) => {
 *     addEventListener("storage", listener);
 *
 *     return () => removeEventListener("storage", listener);
 *   },
 * };
 * ```
 */
export type Subscribable = {
  subscribe(listener: () => void): () => void;
};
