import type { BeaconClock, CheckReason } from "@priemskiyyy/beacon";

/**
 * What a trigger is given when a session opens. A trigger only offers reasons
 * to check: the gate decides whether a check starts, and when.
 *
 * @example
 * ```ts
 * const inAMinute: BeaconTrigger = (target) =>
 *   target.clock.setTimer(() => target.signal("interval"), 60_000);
 * ```
 */
export type TriggerTarget = {
  /** Offers a reason to check. A check in flight answers it, a recent start delays it, and a closed session drops it. */
  signal: (reason: CheckReason) => void;
  /** The clock the Beacon runs on. */
  clock: BeaconClock;
  /** A number in `[0, 1)`: the `random` option, for a trigger that adds jitter. */
  random: () => number;
  /** Whether a trigger has said the app is in the background. */
  isAway: () => boolean;
  /** Says where the app is, so that a timer can pause while it is in the background. */
  setAway: (away: boolean) => void;
  /** Runs after a check the gate started settled, and when `setAway` changed the answer of `isAway`. Answers its removal. */
  onChange: (listener: () => void) => () => void;
};
