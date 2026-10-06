import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * A package CodePush reports as installed and waiting for a restart, which is
 * what its update state calls pending. It is prepared, not running: `reload`
 * asks for the restart, and only a later boot shows what runs. The provider
 * may also pick it up at a start Beacon did not ask for.
 *
 * @example
 * ```ts
 * const prepared: CodePushPrepared = { release, label: "v12", mandatory: false };
 * ```
 */
export type CodePushPrepared = RouteBody & {
  label: string | null;
  mandatory: boolean;
};
