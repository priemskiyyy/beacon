import type { BeaconTrigger } from "src/types/BeaconTrigger";
import type { Subscribable } from "src/types/Subscribable";

/**
 * Checks when a source says "look again", such as a push channel or another
 * tab. The source's payload is never read: what the authority says is what the
 * check reads, so a push cannot claim a release the authority did not publish.
 * It subscribes to the source.
 *
 * @example
 * ```ts
 * declare const channel: Subscribable;
 *
 * checkOn(beacon, { triggers: [invalidation({ source: channel })] });
 * ```
 */
export const invalidation =
  ({ source }: { source: Subscribable }): BeaconTrigger =>
  (target) =>
    source.subscribe(() => {
      target.signal("invalidation");
    });
