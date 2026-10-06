import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningRelease } from "src/types/RunningRelease";
import type { RunningSubject } from "src/types/RunningSubject";

/** The release a subject is running, or `null` while it is unconfigured, pending or failed. */
export const readRunningRelease = (
  running: RunningApplication,
  subject: RunningSubject,
): RunningRelease | null => {
  const fact = running[subject];

  if (fact.state !== "known") {
    return null;
  }

  return fact.release;
};
