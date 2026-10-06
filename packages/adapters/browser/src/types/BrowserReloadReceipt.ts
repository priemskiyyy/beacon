/**
 * What an accepted reload proves: the request to reload was made. The new
 * document may be the same build, a different one, or never arrive.
 *
 * @example
 * ```ts
 * const receipt: BrowserReloadReceipt = { kind: "reload-requested" };
 * ```
 */
export type BrowserReloadReceipt = { kind: "reload-requested" };
