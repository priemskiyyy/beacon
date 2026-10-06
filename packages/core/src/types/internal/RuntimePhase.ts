import type { Session } from "src/types/internal/Session";

/** Where the lifecycle owner stands; the open session and its `stop` belong to the running phase alone. */
export type RuntimePhase =
  | { state: "IDLE" }
  | { state: "RUNNING"; session: Session; stop: () => void }
  | { state: "STOPPED" }
  | { state: "DISPOSED" };
