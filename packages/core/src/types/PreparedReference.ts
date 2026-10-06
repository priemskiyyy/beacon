/**
 * A handle on something a provider reports as ready for a later step, minted
 * by Beacon and good only for its route and only while that preparation is
 * current. An offer reference never fits where a prepared one is asked for.
 *
 * @example
 * ```ts
 * const { prepared } = beacon.route("ota").state.get();
 *
 * if (prepared.status === "ready") {
 *   const reference: PreparedReference<"ota"> = prepared.value.ref;
 * }
 * ```
 */
export type PreparedReference<TRoute extends string> = {
  kind: "prepared";
  route: TRoute;
  id: number;
};
