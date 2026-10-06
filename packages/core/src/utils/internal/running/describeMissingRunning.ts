import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningSubject } from "src/types/RunningSubject";

/** What a selection says when the release a subject runs is not there: its reader has not answered yet, or failed. A subject with no reader, which a feed route cannot have, keeps the plain word. */
export const describeMissingRunning = (
  running: RunningApplication,
  subject: RunningSubject,
) => {
  const { state } = running[subject];

  if (state === "pending") {
    return "running-pending";
  }

  if (state === "failed") {
    return "running-failed";
  }

  return "running-not-known";
};
