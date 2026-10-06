import type { BeaconTrigger } from "src/triggers/types/BeaconTrigger";
import type { ConditionLike } from "src/triggers/types/ConditionLike";

/**
 * Checks when a condition goes from unmet to met, such as a Reach condition
 * for a connection. Only an observed loss is followed by a reconnect: a
 * condition that was unknown, or that was met when this subscribed, is not one.
 * Like `reconnect`, it does not wait out a backoff, and it says the condition
 * holds, not that the authority is reachable. It subscribes to the condition.
 *
 * @example
 * ```ts
 * declare const connected: ConditionLike;
 *
 * checkOn(beacon, { triggers: [reachReconnect({ condition: connected })] });
 * ```
 */
export const reachReconnect =
  ({ condition }: { condition: ConditionLike }): BeaconTrigger =>
  (target) => {
    let last = condition.get().status;

    return condition.subscribe(() => {
      const before = last;

      last = condition.get().status;

      if (before !== "unmet" || last !== "met") {
        return;
      }

      target.signal("reconnect");
    });
  };
