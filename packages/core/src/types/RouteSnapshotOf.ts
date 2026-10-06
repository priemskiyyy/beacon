import type { OfferBodyOf } from "src/types/internal/OfferBodyOf";
import type { PreparedBodyOf } from "src/types/internal/PreparedBodyOf";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteSnapshot } from "src/types/RouteSnapshot";

/**
 * The snapshot of a route, by its name and its definition: what
 * `beacon.route(name).state.get()` returns, with the offer and the prepared
 * target the route's own source or provider gives. A binding names it to type
 * a route it looks up by name.
 *
 * @example
 * ```ts
 * type WebState = RouteSnapshotOf<"web", typeof web>;
 * ```
 */
export type RouteSnapshotOf<
  TName extends string,
  TDefinition extends RouteDefinition,
> = RouteSnapshot<TName, OfferBodyOf<TDefinition>, PreparedBodyOf<TDefinition>>;
