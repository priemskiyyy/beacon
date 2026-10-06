import type { TriggerTarget } from "src/triggers/types/TriggerTarget";

/**
 * Ends an absence: the app is in the foreground again, and it checks unless it
 * was away for less than `minAway`. An absence nobody measured is never short.
 */
export const signalReturn = (
  target: TriggerTarget,
  observedAway: number | null,
  minAway: number,
) => {
  target.setAway(false);

  if (observedAway !== null && observedAway < minAway) {
    return;
  }

  target.signal("foreground");
};
