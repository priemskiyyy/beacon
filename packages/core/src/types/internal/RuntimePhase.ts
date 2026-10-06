import type { Session } from "src/types/internal/Session";

/** Where the lifecycle owner stands; the open session and its `stop` belong to the running phase alone, and `idle` is any time no session is open. */
export type RuntimePhase =
  | { state: "idle" }
  | { state: "running"; session: Session; stop: () => void }
  | { state: "disposed" };
