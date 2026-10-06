import type { BeaconTrigger } from "src/types/BeaconTrigger";

/**
 * Checks `every` milliseconds after the last check the gate started settled,
 * plus up to `jitter` of it at random, so a fleet does not check in step. It
 * pauses while a trigger such as `foreground` says the app is in the
 * background, and waits its full delay again after the return. A timer is only as good as the
 * runtime that runs it, and a backgrounded app may run none, so keep
 * `foreground`. It arms a timer on the Beacon's clock and subscribes to
 * nothing.
 *
 * @example
 * ```ts
 * checkOn(beacon, {
 *   triggers: [interval({ every: 30 * 60_000, jitter: 0.2 })],
 * });
 * ```
 */
export const interval =
  ({ every, jitter = 0 }: { every: number; jitter?: number }): BeaconTrigger =>
  (target) => {
    let cancel = () => {};

    const arm = () => {
      cancel();

      cancel = () => {};

      if (target.isAway()) {
        return;
      }

      cancel = target.clock.setTimer(
        () => {
          cancel = () => {};

          target.signal("interval");
          // A signal the gate drops or delays must not end the cadence.
          arm();
        },
        every + target.random() * every * jitter,
      );
    };

    const stopChanges = target.onChange(arm);

    arm();

    return () => {
      cancel();
      stopChanges();
    };
  };
