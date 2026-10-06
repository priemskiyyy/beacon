import type { OfferReference } from "src/types/OfferReference";
import type { Release } from "src/types/Release";

/**
 * The route's current actionable or informational interpretation of what an
 * authority wants: the release on offer and the reference to act on, plus
 * whatever more the route's provider reports. It is not a prepared target and
 * not a running fact.
 *
 * @example
 * ```ts
 * const { observation } = beacon.route("web").state.get();
 *
 * if (observation.status === "available") {
 *   const { ref, release } = observation.offer;
 * }
 * ```
 */
export type Offer<
  TRoute extends string,
  TBody extends { release: Release<object | null> },
> = { ref: OfferReference<TRoute> } & TBody;
