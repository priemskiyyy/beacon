import type { AppStateLike } from "src/triggers/types/AppStateLike";
import type { BeaconTrigger } from "src/triggers/types/BeaconTrigger";
import { signalReturn } from "src/triggers/utils/signalReturn";

/**
 * Checks when the app returns from the background, from React Native's
 * `AppState`. Only a trip through `background` is a return: on iOS a system
 * dialog, the control center or an incoming call takes the app from `active`
 * to `inactive` and back, and that checks nothing. On Android every pause of
 * the activity is a `background`, so a permission dialog is a trip. An app
 * that starts in the background checks when it first becomes active. With
 * `minAway`, a return after less than that many milliseconds is skipped, and
 * one whose departure was not seen never is. It subscribes to `AppState`'s
 * `change` event, and also tells the gate where the app is, so that `interval`
 * pauses in the background.
 *
 * @example
 * ```ts
 * import { AppState } from "react-native";
 *
 * checkOn(beacon, {
 *   triggers: [foreground({ appState: AppState, minAway: 30_000 })],
 * });
 * ```
 */
export const foreground =
  ({
    appState,
    minAway = 0,
  }: {
    appState: AppStateLike;
    minAway?: number;
  }): BeaconTrigger =>
  (target) => {
    let away = appState.currentState === "background";
    // When the app was seen leaving, or `null` when it started in the background.
    let leftAt: number | null = null;

    target.setAway(away);

    const subscription = appState.addEventListener("change", (state) => {
      if (state === "background") {
        if (!away) {
          leftAt = target.clock.now();
        }

        away = true;
        target.setAway(true);

        return;
      }

      if (state !== "active" || !away) {
        return;
      }

      const observedAway = leftAt === null ? null : target.clock.now() - leftAt;

      away = false;
      leftAt = null;
      signalReturn(target, observedAway, minAway);
    });

    return () => subscription.remove();
  };
