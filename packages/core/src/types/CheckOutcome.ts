import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";

/**
 * How one caller's check settled. `succeeded` means the authority answered and
 * the answer was accepted, not that anything is on offer; `failed` leaves the
 * last accepted observation in place; `cancelled` means the caller's own
 * signal ended its wait; `superseded` means the session or scope changed under
 * the read.
 *
 * @example
 * ```ts
 * const outcome = await beacon.route("web").check();
 *
 * if (outcome.status === "failed") {
 *   console.warn(outcome.error.code);
 * }
 * ```
 */
export type CheckOutcome =
  | { status: "succeeded"; attempt: number }
  | { status: "failed"; attempt: number; error: BeaconErrorInfo }
  | { status: "cancelled" }
  | { status: "superseded" };
