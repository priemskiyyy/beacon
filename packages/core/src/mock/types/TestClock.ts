import type { BeaconClock } from "src/types/BeaconClock";

/**
 * A manual `BeaconClock` for tests. `advance` runs timers in the order they
 * fall due and at their own time, and those already due when it is zero;
 * `suspend` moves time as a frozen page does, and `setNow` moves epoch time
 * alone, backwards included.
 *
 * @example
 * ```ts
 * const clock = createTestClock();
 * const beacon = new Beacon({ scope, running, routes, clock });
 *
 * clock.advance(30_000);
 * ```
 */
export type TestClock = BeaconClock & {
  /** Moves time forward, running every timer that falls due on the way, or is due already. */
  advance: (milliseconds: number) => void;
  /** Moves time forward without running a timer, as a suspended runtime does. */
  suspend: (milliseconds: number) => void;
  /** Sets epoch time alone, as a clock correction does. */
  setNow: (epochMilliseconds: number) => void;
  /** Timers armed and neither run nor cancelled. */
  pendingTimers: () => number;
};
