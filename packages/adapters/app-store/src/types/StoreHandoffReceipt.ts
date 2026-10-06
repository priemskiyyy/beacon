/**
 * What an accepted handoff proves: the OS accepted the request to open the
 * store page. The user can decline, lack eligibility or never return, and
 * nothing here says an installation began.
 *
 * @example
 * ```ts
 * const receipt: StoreHandoffReceipt = { kind: "store-handoff-accepted" };
 * ```
 */
export type StoreHandoffReceipt = { kind: "store-handoff-accepted" };
