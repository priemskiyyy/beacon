/**
 * A handle on something a provider reports as ready for a later step, minted
 * by Beacon and good only for its route and only while that preparation is
 * current. An offer reference never fits where a prepared one is asked for.
 *
 * @example
 * ```ts
 * const reference: PreparedReference<"ota"> = prepared.prepared.ref;
 * ```
 */
export type PreparedReference<TRoute extends string> = {
  kind: "prepared";
  route: TRoute;
  id: number;
};
