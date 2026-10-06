import type { Beacon, RouteDefinition } from "@priemskiyyy/beacon";

import type { CheckOnOptions } from "src/types/CheckOnOptions";
import { openGate } from "src/utils/openGate";

/**
 * Checks the Beacon on the moments its triggers name, and answers how to stop.
 * It subscribes to the Beacon's own status and to nothing else: a session that
 * opens installs the triggers, each of which subscribes to its own source, and
 * a session that ends takes them all back, so `checkOn` may come before
 * `beacon.start()` and again after `beacon.stop()`. Every session gets a new
 * gate: a `replaceScope` starts from no failure counted and fires `startup`
 * again. A trigger that throws on install costs only itself, and its error
 * reaches the host outside the call. Stopping leaves no listener and no timer.
 *
 * @example
 * ```ts
 * const stop = checkOn(beacon, {
 *   triggers: [startup(), interval({ every: 30 * 60_000, jitter: 0.2 })],
 *   backoff: { first: 10_000, max: 15 * 60_000 },
 * });
 *
 * beacon.start();
 * stop();
 * ```
 */
export const checkOn = <TRoutes extends Record<string, RouteDefinition>>(
  beacon: Beacon<TRoutes>,
  options: CheckOnOptions,
) => {
  let close: (() => void) | null = null;

  // A notification says the session changed, so what served the last one is over.
  const follow = () => {
    const status = beacon.status.get();

    close?.();
    close = null;

    if (status.state !== "running") {
      return;
    }

    close = openGate(beacon, options);
  };

  const unsubscribe = beacon.status.subscribe(follow);

  follow();

  return () => {
    unsubscribe();
    close?.();
    close = null;
  };
};
