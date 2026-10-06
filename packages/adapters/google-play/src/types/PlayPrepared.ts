import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * A flexible update Play reports as downloaded. It is prepared, not
 * installed: completing it is a separate, guarded command.
 *
 * @example
 * ```ts
 * const prepared: PlayPrepared = { release, flow: "flexible" };
 * ```
 */
export type PlayPrepared = RouteBody & { flow: "flexible" };
