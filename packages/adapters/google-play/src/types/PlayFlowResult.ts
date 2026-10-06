/**
 * How the native consent flow ended: `started` when the user agreed and Play
 * took over, `cancelled` when the user declined, `failed` when Play reported a
 * failure. It says nothing about the transfer that follows.
 *
 * @example
 * ```ts
 * const result: PlayFlowResult = "cancelled";
 * ```
 */
export type PlayFlowResult = "started" | "cancelled" | "failed";
