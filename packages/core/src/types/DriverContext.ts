import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningApplication } from "src/types/RunningApplication";

/**
 * What a driver is given when its route opens: the scope, a read-only view of
 * what is running, and the fenced emitter. It cannot write running facts.
 *
 * @example
 * ```ts
 * const open = ({ scope, running, emit }: DriverContext<PlayOffer, UpdateBody>) => ({ native: bridge });
 * ```
 */
export type DriverContext<
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
> = {
  scope: ReleaseScope;
  running: ObservableValue<RunningApplication>;
  emit: DriverEmitter<TOffer, TPrepared>;
};
