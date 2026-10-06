import type { BlockReason } from "src/types/BlockReason";
import type { Lease } from "src/types/internal/Lease";

/** What asking every relevant participant for a reservation came to. */
export type ReservationOutcome =
  | { status: "reserved"; lease: Lease }
  | { status: "blocked"; reasons: BlockReason[] };
