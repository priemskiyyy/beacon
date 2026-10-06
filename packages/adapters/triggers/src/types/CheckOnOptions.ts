import type { BeaconTrigger } from "src/types/BeaconTrigger";

/**
 * Options for `checkOn()`: which moments check, and how the gate behind them
 * treats a burst and a failure. The first check of each session is the gate's:
 * `startup` is on unless you turn it off. `minInterval` and `backoff` are the
 * ones most applications set; the rest is advanced, and its defaults are the
 * right ones until a real authority says otherwise. Durations are
 * milliseconds.
 *
 * @example
 * ```ts
 * const options: CheckOnOptions = {
 *   triggers: [interval({ every: 30 * 60_000, jitter: 0.2 })],
 *   backoff: { first: 10_000, max: 15 * 60_000 },
 * };
 * ```
 */
export type CheckOnOptions = {
  triggers: BeaconTrigger[];
  /** Checks once each time a session opens, including the one `replaceScope` starts, `true` by default. `false` leaves the first check to the triggers. */
  startup?: boolean;
  /** The least time between two starts of a check, 5,000 by default. Signals inside it become one later start. */
  minInterval?: number;
  /**
   * After a failed check, waits before the next start and retries by itself,
   * doubling the wait for each consecutive failure up to `max`. `false`, the
   * default, retries nothing by itself and delays nothing.
   */
  backoff?:
    | {
        /** The wait after the first failure. */
        first: number;
        /** The longest wait. */
        max: number;
        /** The share of the wait added at random, from 0 to 1, 0.2 by default. */
        jitter?: number;
        /** Advanced: the retries the gate starts by itself before it waits for the next signal, 3 by default. */
        attempts?: number;
      }
    | false;
  /** Advanced: `skip` drops a foreground or interval signal while every route holds fresh evidence that can expire. `check`, the default, never drops one. */
  whileFresh?: "check" | "skip";
  /** Advanced: checks when the authority's own `expiresAt` passes, heard through the route state. It arms no timer of its own. */
  onExpiry?: boolean;
  /** Advanced: the random source of the jitter, `Math.random` by default. */
  random?: () => number;
};
