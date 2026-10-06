import type { FeedResult } from "src/types/internal/FeedResult";

/** One caller waiting for a feed read, and the group it belongs to. */
export type FeedWaiter = {
  settle: (result: FeedResult) => void;
  group: FeedWaiterGroup;
};

/** The callers a single read serves. */
export type FeedWaiterGroup = {
  waiters: Set<FeedWaiter>;
};
