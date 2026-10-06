/**
 * Every time source and timer Beacon uses: published timestamps and freshness
 * run on `now`, and delays on `setTimer`. Tests pass `createTestClock()` from
 * `@priemskiyyy/beacon/mock`. A `setTimer` that throws is a timer that could
 * not be armed, and Beacon never throws it into the host: a read or a
 * participant's settlement that needed it fails, and a document whose expiry
 * it would have watched is treated as expired.
 *
 * @example
 * ```ts
 * const clock: BeaconClock = {
 *   now: () => Date.now(),
 *   setTimer: (callback, delay) => {
 *     const timer = setTimeout(callback, delay);
 *
 *     return () => clearTimeout(timer);
 *   },
 * };
 * ```
 */
export type BeaconClock = {
  /** Epoch milliseconds, for published timestamps. */
  now: () => number;
  /** Runs `callback` once after `delay` milliseconds and answers its cancel. */
  setTimer: (callback: () => void, delay: number) => () => void;
};
