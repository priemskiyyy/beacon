import type { RouteBody } from "src/types/RouteBody";

/**
 * What a provider driver reports as ready: nothing, or a target it confirms.
 * Only a confirmation from the provider may say `ready`; a command that
 * returned is not one.
 *
 * @example
 * ```ts
 * const draft: PreparedDraft<UpdateBody> = { status: "ready", value: { release } };
 * ```
 */
export type PreparedDraft<TPrepared extends RouteBody> =
  { status: "none" } | { status: "ready"; value: TPrepared };
