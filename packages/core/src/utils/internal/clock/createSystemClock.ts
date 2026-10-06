import type { BeaconClock } from "src/types/BeaconClock";
import { MAX_TIMER_DELAY } from "src/utils/constants/timers";

/** The host's clocks and timers, read only when used, so creating a Beacon on a server reads nothing. */
export const createSystemClock = (): BeaconClock => ({
  now: () => Date.now(),
  setTimer: (callback, delay) => {
    const timer = setTimeout(
      callback,
      Math.min(Math.max(delay, 0), MAX_TIMER_DELAY),
    );

    return () => clearTimeout(timer);
  },
});
