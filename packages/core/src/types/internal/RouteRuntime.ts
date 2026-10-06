import type { CheckOutcome } from "src/types/CheckOutcome";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { Session } from "src/types/internal/Session";
import type { RunningSubject } from "src/types/RunningSubject";

/** What differs between a feed route and a driver route: what its check selects against, what a session opens for it, and how it is checked. */
export type RouteRuntime = {
  /** The running subjects the check of this route selects against: its own for a feed route, none for a provider that answers by itself. */
  dependsOn: RunningSubject[];
  open: (session: Session) => void;
  /** Answers how this caller's check settled; it never rejects. */
  check: (session: Session, options: ReadOptions) => Promise<CheckOutcome>;
};
