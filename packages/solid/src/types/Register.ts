import type { RouteHandle, RouteSnapshotOf } from "@priemskiyyy/beacon";

import type { BeaconOf } from "src/types/internal/BeaconOf";
import type { RoutesOf } from "src/types/internal/RoutesOf";

/**
 * Tells the primitives which Beacon the application has, so a route name is checked
 * and its state is typed. Merge it once, next to the Beacon:
 *
 * @example
 * ```ts
 * export const beacon = new Beacon({ scope, running, routes: { web } });
 *
 * declare module "@priemskiyyy/beacon-solid" {
 *   interface Register {
 *     beacon: typeof beacon;
 *   }
 * }
 * ```
 */
export interface Register {}

/**
 * The routes of the registered Beacon. While none is registered, the only
 * route is named after the fix, so the first route name a primitive is given says
 * how to register.
 */
export type RegisteredRoutes = RoutesOf<Register>;

/**
 * The Beacon the application registered. While none is registered it is every
 * Beacon without its routes, so the provider still accepts yours.
 */
export type RegisteredBeacon = BeaconOf<Register>;

/** The name of a route of the registered Beacon. */
export type RegisteredRouteName = keyof RegisteredRoutes & string;

/** The handle of a route of the registered Beacon. */
export type RegisteredRoute<TName extends RegisteredRouteName> = RouteHandle<
  TName,
  RegisteredRoutes[TName]
>;

/** The state of a route of the registered Beacon. */
export type RegisteredRouteState<TName extends RegisteredRouteName> =
  RouteSnapshotOf<TName, RegisteredRoutes[TName]>;
