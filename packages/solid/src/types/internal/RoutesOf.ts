import type { Beacon, RouteDefinition } from "@priemskiyyy/beacon";

import type { UnregisteredRouteName } from "src/types/internal/UnregisteredRouteName";

/**
 * The routes of the Beacon a `Register` names, or the one route that says how
 * to register one.
 */
export type RoutesOf<TRegister> = TRegister extends {
  beacon: Beacon<infer TRoutes>;
}
  ? TRoutes
  : { [Name in UnregisteredRouteName]: RouteDefinition };
