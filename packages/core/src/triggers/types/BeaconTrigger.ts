import type { TriggerTarget } from "src/triggers/types/TriggerTarget";

/**
 * A moment to check on. `checkOn` calls it each time a session opens, and it
 * answers how to take back everything it subscribed to or armed. One that
 * throws on install costs only itself.
 *
 * @example
 * ```ts
 * const onStorage: BeaconTrigger = (target) => {
 *   const listener = () => target.signal("invalidation");
 *
 *   addEventListener("storage", listener);
 *
 *   return () => removeEventListener("storage", listener);
 * };
 * ```
 */
export type BeaconTrigger = (target: TriggerTarget) => () => void;
