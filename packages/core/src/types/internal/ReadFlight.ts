import type { ReadWaiterGroup } from "src/types/internal/ReadWaiter";
import type { Session } from "src/types/internal/Session";

/** One physical read: the attempt it carries, how to abort it, and who waits for it. */
export type ReadFlight = {
  attempt: number;
  session: Session;
  controller: AbortController;
  group: ReadWaiterGroup;
  /** Set when nobody waits anymore or the read ended, so a late answer is ignored. */
  finished: boolean;
  /** Stops the deadline and takes the read back from its session. */
  release: () => void;
};
