import type { CheckState } from "src/types/CheckState";
import type { Observation } from "src/types/Observation";
import type { OperationState } from "src/types/OperationState";
import type { PreparedState } from "src/types/PreparedState";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Everything published about one route, in dimensions that never rewrite each
 * other: the latest check, the accepted observation, what is prepared and the
 * running operation. The snapshot keeps its identity until one of them
 * changes. It and each dimension are frozen, and so are an offer, a prepared
 * value and evidence. The `release` inside an offer, a prepared value or a
 * candidate is the object the source or provider handed over: Beacon keeps it
 * as it is, neither copying nor freezing it, and never changes it, so treat it
 * as read-only.
 *
 * @example
 * ```ts
 * const snapshot = beacon.route("web").state.get();
 * ```
 */
export type RouteSnapshot<
  TRoute extends string,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
> = {
  /** Grows with every meaningful change of this snapshot. */
  revision: number;
  check: CheckState;
  observation: Observation<TRoute, TOffer>;
  prepared: PreparedState<TRoute, TPrepared>;
  operation: OperationState;
};
