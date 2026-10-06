import type { BlockReason } from "src/types/BlockReason";

/** The reservations one command holds: settle the work begun, then release every one. */
export type Lease = {
  /** The participant registry's revision when the reservations were taken. */
  revision: number;
  /** Waits for every participant; answers who is not ready, or nothing when all are. */
  settle: (signal: AbortSignal) => Promise<BlockReason[]>;
  release: () => void;
};
