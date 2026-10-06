import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * What an offer and a prepared target carry besides the release: whether they
 * are an update to run or a rollback to the update embedded in the build.
 *
 * @example
 * ```ts
 * const body: ExpoBody = { release, kind: "update" };
 * ```
 */
export type ExpoBody = RouteBody & { kind: "update" | "rollback-to-embedded" };
