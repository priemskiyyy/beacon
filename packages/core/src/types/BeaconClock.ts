/**
 * Every time source and timer Beacon uses. Published timestamps run on `now`,
 * durations and ordering on `monotonic`, and freshness ends when either says
 * it has. Tests pass `createTestClock()` from `@priemskiyyy/beacon/mock`.
 *
 * @example
 * ```ts
 * const clock: BeaconClock = {
 *   now: () => Date.now(),
 *   monotonic: () => performance.now(),
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
  /** Milliseconds from an arbitrary origin that never goes back, for durations. */
  monotonic: () => number;
  /** Runs `callback` once after `delay` milliseconds and answers its cancel. */
  setTimer: (callback: () => void, delay: number) => () => void;
};
