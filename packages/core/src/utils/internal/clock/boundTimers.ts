import type { BeaconClock } from "src/types/BeaconClock";
import { MAX_TIMER_DELAY } from "src/utils/constants/timers";

/**
 * The same clock, asked for no wait a host timer cannot hold. A host timer
 * given more than 2^31 - 1 milliseconds fires at once, so a wait of a month, a
 * document's expiry or a timeout the application set that high, would be spent
 * in a moment: a wait longer than this one is cut to it, and whoever waits
 * for longer, as a document does until its expiry, arms the timer again when
 * it fires.
 */
export const boundTimers = (clock: BeaconClock): BeaconClock => ({
  now: () => clock.now(),
  setTimer: (callback, delay) =>
    clock.setTimer(callback, Math.min(Math.max(delay, 0), MAX_TIMER_DELAY)),
});
