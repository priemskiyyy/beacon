import type { Beacon, CheckOptions, CheckReport } from "@priemskiyyy/beacon";

/**
 * The Beacon a primitive returns while `Register` names none, which every Beacon
 * fits: everything but its routes. A route is read by a name the application
 * registered, so without one there is no `route`, and a check reports its
 * routes by any name.
 */
export type UnregisteredBeacon = Omit<
  Beacon,
  "route" | "routeNames" | "check"
> & {
  routeNames: string[];
  check(options?: CheckOptions): Promise<CheckReport<string>>;
};
