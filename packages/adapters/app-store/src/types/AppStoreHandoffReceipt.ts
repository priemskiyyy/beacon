/**
 * What an accepted handoff proves: the OS accepted the request to open the
 * store page. The user can decline, lack eligibility or never return, and
 * nothing here says an installation began.
 *
 * @example
 * ```ts
 * const receipt: AppStoreHandoffReceipt = { kind: "store-handoff-requested" };
 * ```
 */
export type AppStoreHandoffReceipt = { kind: "store-handoff-requested" };
