/**
 * A handle on one offer, minted by Beacon and good only for its route and only
 * while that offer is current. It is the object Beacon gave you: a copy is
 * refused, and so is one from another Beacon.
 *
 * @example
 * ```ts
 * const reference: OfferReference<"web"> = observation.offer.ref;
 * ```
 */
export type OfferReference<TRoute extends string> = {
  kind: "offer";
  route: TRoute;
  id: number;
};
