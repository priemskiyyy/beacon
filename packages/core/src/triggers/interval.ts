import type { BeaconTrigger } from "src/triggers/types/BeaconTrigger";
import { BeaconError } from "src/utils/BeaconError";
import { MAX_TIMER_DELAY } from "src/utils/constants/timers";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";

/**
 * Checks `every` milliseconds after the last check the gate started settled,
 * plus up to `jitter` of it at random, so a fleet does not check in step. It
 * pauses while a trigger such as `foreground` says the app is in the
 * background, and waits its full delay again after the return. A timer is only as good as the
 * runtime that runs it, and a backgrounded app may run none, so keep
 * `foreground`. It arms a timer on the Beacon's clock and subscribes to
 * nothing. An `every` that is not a positive whole number of milliseconds, or
 * a `jitter` that is not a finite number of at least zero, throws
 * `INVALID_CONFIGURATION` when it is made, since a delay that is none would
 * arm the timer again at once, for ever.
 *
 * @example
 * ```ts
 * checkOn(beacon, {
 *   triggers: [interval({ every: 30 * 60_000, jitter: 0.2 })],
 * });
 * ```
 */
export const interval = ({
  every,
  jitter = 0,
}: {
  every: number;
  jitter?: number;
}): BeaconTrigger => {
  resolveDuration("every", every, every);

  if (!Number.isFinite(jitter) || jitter < 0) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "jitter must be a finite number of at least zero.",
    });
  }

  return (target) => {
    let cancel = () => {};

    const arm = () => {
      cancel();

      cancel = () => {};

      if (target.isAway()) {
        return;
      }

      // A host timer holds a bounded delay, and a longer one would fire at once and arm itself again.
      cancel = target.clock.setTimer(
        () => {
          cancel = () => {};

          target.signal("interval");
          // A signal the gate drops or delays must not end the cadence.
          arm();
        },
        Math.min(every + target.random() * every * jitter, MAX_TIMER_DELAY),
      );
    };

    const stopChanges = target.onChange(arm);

    arm();

    return () => {
      cancel();
      stopChanges();
    };
  };
};
