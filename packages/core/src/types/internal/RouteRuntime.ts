import type { CheckOutcome } from "src/types/CheckOutcome";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { Session } from "src/types/internal/Session";

/** What differs between a feed route and a driver route: what a session opens for it, and how it is checked. */
export type RouteRuntime = {
  open: (session: Session) => void;
  /** Answers how this caller's check settled; it never rejects. */
  check: (session: Session, options: ReadOptions) => Promise<CheckOutcome>;
};
