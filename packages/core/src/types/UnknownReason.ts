/**
 * Why a route has no observation at all.
 *
 * - `not-checked`: nothing has been accepted yet in this session.
 * - `unsupported-environment`: the provider cannot run here, such as a native
 *   update module in a development client.
 *
 * @example
 * ```ts
 * const reason: UnknownReason = "not-checked";
 * ```
 */
export type UnknownReason = "not-checked" | "unsupported-environment";
