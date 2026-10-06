import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * What an offer carries besides the release: the flows Play allows now, and
 * its own priority and staleness, which stay provider facts and never become
 * support policy. `inProgress` marks a flow this app already started that Play
 * still holds, which the immediate flow continues.
 *
 * @example
 * ```ts
 * const offer: PlayOffer = { release, flows: ["flexible"], priority: 3, stalenessDays: 9, inProgress: false };
 * ```
 */
export type PlayOffer = RouteBody & {
  flows: Array<"flexible" | "immediate">;
  priority: number;
  stalenessDays: number | null;
  inProgress: boolean;
};
