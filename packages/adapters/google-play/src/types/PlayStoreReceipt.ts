/**
 * What an accepted handoff proves: the OS accepted the request to open the
 * store page, in the Play Store app or, where it is not there, in the browser.
 * The user can decline or never return, and nothing here says an installation
 * began.
 *
 * @example
 * ```ts
 * const receipt: PlayStoreReceipt = { kind: "store-handoff-requested" };
 * ```
 */
export type PlayStoreReceipt = { kind: "store-handoff-requested" };
