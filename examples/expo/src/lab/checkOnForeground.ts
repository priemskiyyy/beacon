/** The part of React Native's `AppState` the recipe uses: the module satisfies it. */
export type AppStateLike = {
  currentState: string | null | undefined;
  addEventListener(
    type: "change",
    listener: (state: string) => void,
  ): { remove(): void };
};

/** The part of a Beacon the recipe asks. */
export type CheckingBeacon = {
  check(options: { reason: "foreground" }): Promise<unknown>;
};

/**
 * Checks when the app returns from the background. On iOS a system dialog, the
 * control center or an incoming call takes the app from active to inactive and
 * back, and only a trip through the background is a return; on Android every
 * activity pause is a background, so a permission dialog counts as one. The
 * check joins a read already in flight, so a quick second return asks nothing
 * more. It answers the stop that removes the one listener it added, and it
 * dies with the JavaScript runtime when an update reloads it.
 */
export const checkOnForeground = (
  beacon: CheckingBeacon,
  appState: AppStateLike,
) => {
  let away = appState.currentState === "background";

  const subscription = appState.addEventListener("change", (state) => {
    if (state === "background") {
      away = true;

      return;
    }

    if (state !== "active" || !away) {
      return;
    }

    away = false;
    beacon.check({ reason: "foreground" });
  });

  return () => subscription.remove();
};
