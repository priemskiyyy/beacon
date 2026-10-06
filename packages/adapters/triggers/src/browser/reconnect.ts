import type { ReconnectWindowLike } from "src/browser/types/ReconnectWindowLike";
import { getGlobalWindow } from "src/browser/utils/getGlobalWindow";
import type { BeaconTrigger } from "src/types/BeaconTrigger";

/**
 * Checks when the browser says the network came back, from the window's
 * `online` event. The event fires only on a change, so a page that is online
 * when it loads is not a reconnect and nothing is checked at startup. A
 * reconnect does not wait out a backoff, and its check begins after the read
 * that may have met the dead network. It says the browser is online, not that
 * the authority is reachable. It listens to the global `window`, reached when a
 * session opens, or to `target`; in a server render there is none, and it
 * installs nothing.
 *
 * @example
 * ```ts
 * import { checkOn } from "@priemskiyyy/beacon-triggers";
 * import { reconnect } from "@priemskiyyy/beacon-triggers/browser";
 *
 * checkOn(beacon, { triggers: [reconnect()] });
 * ```
 */
export const reconnect =
  ({ target }: { target?: ReconnectWindowLike } = {}): BeaconTrigger =>
  (trigger) => {
    const host: ReconnectWindowLike | null = target ?? getGlobalWindow();

    if (host === null) {
      return () => {};
    }

    const listener = () => trigger.signal("reconnect");

    host.addEventListener("online", listener);

    return () => host.removeEventListener("online", listener);
  };
