import type { ObservationDraft } from "src/types/ObservationDraft";
import type { PreparedDraft } from "src/types/PreparedDraft";
import type { RouteBody } from "src/types/RouteBody";

/**
 * How a driver reports what its provider says between checks, such as a
 * worker changing state or a download progressing. Every call is fenced by the
 * session it was given to: after the session ends, a call is counted and
 * dropped.
 *
 * @example
 * ```ts
 * context.emit.progress(0.4);
 * ```
 */
export type DriverEmitter<
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
> = {
  observation(draft: ObservationDraft<TOffer>): void;
  prepared(draft: PreparedDraft<TPrepared>): void;
  /** A fraction between 0 and 1, or `null` when the provider cannot say. */
  progress(fraction: number | null): void;
};
