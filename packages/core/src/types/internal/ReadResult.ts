import type { BeaconError } from "src/utils/BeaconError";

/** How one waiter's shared read settled. */
export type ReadResult =
  | { status: "accepted"; attempt: number }
  | { status: "failed"; attempt: number; error: BeaconError }
  | { status: "cancelled" }
  | { status: "superseded" };
