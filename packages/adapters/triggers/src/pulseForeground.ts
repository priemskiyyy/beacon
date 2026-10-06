import type { BeaconTrigger } from "src/types/BeaconTrigger";
import type { ForegroundSourceLike } from "src/types/ForegroundSourceLike";
import { signalReturn } from "src/utils/signalReturn";

/**
 * Checks when a Pulse says the app returned, on the web or in React Native.
 * With `minAway`, a return after less than that many milliseconds is skipped,
 * and one whose `observedAway` is `null`, because the departure was not
 * observed, never is. It subscribes to the source's `foreground` and
 * `background` events, and tells the gate where the app is, so that `interval`
 * pauses in the background. The source has to be started by the application.
 *
 * @example
 * ```ts
 * declare const pulse: ForegroundSourceLike;
 *
 * checkOn(beacon, {
 *   triggers: [pulseForeground({ source: pulse, minAway: 30_000 })],
 * });
 * ```
 */
export const pulseForeground =
  ({
    source,
    minAway = 0,
  }: {
    source: ForegroundSourceLike;
    minAway?: number;
  }): BeaconTrigger =>
  (target) => {
    const stopBackground = source.on("background", () => {
      target.setAway(true);
    });

    const stopForeground = source.on("foreground", ({ observedAway }) => {
      signalReturn(target, observedAway, minAway);
    });

    return () => {
      stopForeground();
      stopBackground();
    };
  };
