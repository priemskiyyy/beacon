import type { Beacon } from "@priemskiyyy/beacon";

import type { UnregisteredBeacon } from "src/types/internal/UnregisteredBeacon";

/**
 * The Beacon a `Register` names, or the one every Beacon fits while it names
 * none.
 */
export type BeaconOf<TRegister> = TRegister extends {
  beacon: Beacon<infer TRoutes>;
}
  ? Beacon<TRoutes>
  : UnregisteredBeacon;
