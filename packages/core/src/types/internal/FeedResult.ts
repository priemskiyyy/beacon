import type { BeaconError } from "src/utils/BeaconError";

/** How one waiter's read of a feed settled. */
export type FeedResult =
  | { status: "accepted"; attempt: number }
  | { status: "failed"; attempt: number; error: BeaconError }
  | { status: "cancelled" }
  | { status: "superseded" };
