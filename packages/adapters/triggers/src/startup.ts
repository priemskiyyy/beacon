import type { BeaconTrigger } from "src/types/BeaconTrigger";

/**
 * Checks once each time a session opens, including the one `replaceScope`
 * starts for a new scope. It subscribes to nothing.
 *
 * @example
 * ```ts
 * checkOn(beacon, { triggers: [startup()] });
 * ```
 */
export const startup = (): BeaconTrigger => (target) => {
  target.signal("startup");

  return () => {};
};
