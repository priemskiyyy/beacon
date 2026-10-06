import type { CheckState } from "src/types/CheckState";
import type { Observation } from "src/types/Observation";
import type { OperationState } from "src/types/OperationState";
import type { PreparedState } from "src/types/PreparedState";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Everything published about one route, in dimensions that never rewrite each
 * other: the latest check, the accepted observation, what is prepared and the
 * running operation. The snapshot keeps its identity until one of them
 * changes.
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
