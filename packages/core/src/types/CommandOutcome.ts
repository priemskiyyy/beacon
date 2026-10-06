import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { BlockReason } from "src/types/BlockReason";
import type { StaleReason } from "src/types/StaleReason";

/**
 * How a command settled. Every expected failure, denial, cancellation and
 * uncertainty is a status, never a rejection, and the receipt of `accepted`
 * names what was accepted: a reload request, a store handoff, a started flow.
 * None of them means the running code changed. `indeterminate` means the
 * command may have taken effect and its outcome was lost, so it is never
 * retried blindly.
 *
 * @example
 * ```ts
 * const outcome = await beacon.route("web").requestReload({ offer: offer.ref });
 *
 * if (outcome.status === "blocked") {
 *   console.info(outcome.reasons.map((reason) => reason.code));
 * }
 * ```
 */
export type CommandOutcome<TReceipt extends { kind: string }> =
  | { status: "accepted"; operation: { id: number }; receipt: TReceipt }
  | { status: "blocked"; reasons: BlockReason[] }
  | { status: "stale"; reason: StaleReason }
  | { status: "unsupported"; reason: string }
  | { status: "cancelled"; stage: string }
  | { status: "failed"; error: BeaconErrorInfo }
  | { status: "indeterminate"; operation: { id: number }; reason: string };
