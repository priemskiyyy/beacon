/**
 * What an accepted reload proves: the SDK verified the app can reload and
 * posted the request. No code after it is guaranteed to run, and only the
 * next boot shows which update is running.
 *
 * @example
 * ```ts
 * const receipt: ExpoReloadReceipt = { kind: "reload-requested" };
 * ```
 */
export type ExpoReloadReceipt = { kind: "reload-requested" };
