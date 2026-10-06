import type { Beacon } from "@priemskiyyy/beacon";

/**
 * What the provider and the hooks use of a Beacon, whatever its routes: its
 * status, what is running, its support, its disruption participants, and its
 * session. A
 * route's own handle is passed to `useRoute`, so its types stay precise.
 *
 * @example
 * ```ts
 * const beacon: ReactBeacon = new Beacon({ scope, running, routes: { web } });
 * ```
 */
export type ReactBeacon = Pick<
  Beacon,
  "status" | "running" | "support" | "disruptions" | "start"
>;
