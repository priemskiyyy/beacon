import type { ReadResult } from "src/types/internal/ReadResult";

/** One caller waiting for a shared read, and the group it belongs to. */
export type ReadWaiter = {
  settle: (result: ReadResult) => void;
  group: ReadWaiterGroup;
};

/** The callers a single read serves. */
export type ReadWaiterGroup = {
  waiters: Set<ReadWaiter>;
};
