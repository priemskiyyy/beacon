import type { FeedWaiterGroup } from "src/types/internal/FeedWaiter";
import type { Session } from "src/types/internal/Session";

/** One physical read of a source: the attempt it carries, how to abort it, and who waits for it. */
export type FeedFlight = {
  attempt: number;
  session: Session;
  controller: AbortController;
  group: FeedWaiterGroup;
  /** Set when nobody waits anymore or the read ended, so a late answer is ignored. */
  finished: boolean;
  /** Stops the deadline and takes the read back from its session. */
  release: () => void;
};
