import type { WorkerMessage } from "src/types/WorkerMessage";

/** The message the common skip-waiting recipe listens for. */
export const SKIP_WAITING_MESSAGE: WorkerMessage = Object.freeze({
  type: "SKIP_WAITING",
});
