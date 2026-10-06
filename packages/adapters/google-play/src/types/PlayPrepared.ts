import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * A flexible update Play reports as downloaded. It is prepared, not
 * installed: completing it is a separate, guarded command. Only the flexible
 * flow prepares anything: the immediate flow is Play's own UI taking over, and
 * leaves no target to complete.
 *
 * @example
 * ```ts
 * const prepared: PlayPrepared = { release };
 * ```
 */
export type PlayPrepared = RouteBody;
