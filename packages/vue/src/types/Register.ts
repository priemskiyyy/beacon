import type {
  Beacon,
  RouteDefinition,
  RouteHandle,
  RouteSnapshotOf,
} from "@priemskiyyy/beacon";

/**
 * Tells the composables which Beacon the application has, so a route name is
 * checked and its state is typed. Merge it once, next to the Beacon:
 *
 * @example
 * ```ts
 * export const beacon = new Beacon({ scope, running, routes: { web } });
 *
 * declare module "@priemskiyyy/beacon-vue" {
 *   interface Register {
 *     beacon: typeof beacon;
 *   }
 * }
 * ```
 */
export interface Register {}

type Registration = Register extends { beacon: Beacon<infer TRoutes> }
  ? TRoutes
  : Record<string, RouteDefinition>;

/** The routes of the registered Beacon, or any route while none is registered. */
export type RegisteredRoutes = Registration;

/** The Beacon the application registered. */
export type RegisteredBeacon = Beacon<RegisteredRoutes>;

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
