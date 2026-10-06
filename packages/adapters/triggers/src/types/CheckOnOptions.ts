import type { BeaconTrigger } from "src/types/BeaconTrigger";

/**
 * Options for `checkOn()`: which moments check, and how the gate behind them
 * treats a burst, a failure and a fresh answer. Durations are milliseconds.
 *
 * @example
 * ```ts
 * const options: CheckOnOptions = {
 *   triggers: [startup(), interval({ every: 30 * 60_000, jitter: 0.2 })],
 *   minInterval: 10_000,
 *   backoff: { first: 10_000, max: 15 * 60_000 },
 *   whileFresh: "skip",
 *   onExpiry: true,
 * };
 * ```
 */
export type CheckOnOptions = {
  triggers: BeaconTrigger[];
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
        /** The retries the gate starts by itself before it waits for the next signal, 3 by default. */
        attempts?: number;
      }
    | false;
  /** `skip` drops a foreground or interval signal while every route holds fresh evidence that can expire. `check`, the default, never drops one. */
  whileFresh?: "check" | "skip";
  /** Checks when the authority's own `expiresAt` passes, heard through the route state. It arms no timer of its own. */
  onExpiry?: boolean;
  /** The random source of the jitter, `Math.random` by default. */
  random?: () => number;
};
