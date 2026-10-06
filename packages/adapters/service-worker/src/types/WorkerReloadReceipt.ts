/**
 * What an accepted reload proves: the request to reload was made. The new
 * document is served by whichever worker controls the page then.
 *
 * @example
 * ```ts
 * const receipt: WorkerReloadReceipt = { kind: "reload-requested" };
 * ```
 */
export type WorkerReloadReceipt = { kind: "reload-requested" };
