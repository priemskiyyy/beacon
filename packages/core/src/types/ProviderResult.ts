import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";

/**
 * What a provider command reports, and nothing more than the provider proves:
 * `accepted` carries a receipt that names what was accepted, never a bare
 * "updated". `stale` says the provider no longer has the target; `unsupported`
 * that this environment cannot do it; `indeterminate` that it may have taken
 * effect.
 *
 * @example
 * ```ts
 * const result: ProviderResult<{ kind: "reload-requested" }> = {
 *   status: "accepted",
 *   receipt: { kind: "reload-requested" },
 * };
 * ```
 */
export type ProviderResult<TReceipt extends { kind: string }> =
  | { status: "accepted"; receipt: TReceipt }
  | { status: "stale" }
  | { status: "unsupported"; reason: string }
  | { status: "cancelled"; stage: string }
  | { status: "failed"; error: BeaconErrorInfo }
  | { status: "indeterminate"; reason: string };
