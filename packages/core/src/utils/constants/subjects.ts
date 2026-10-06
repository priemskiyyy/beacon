import type { RunningSubject } from "src/types/RunningSubject";

/** Every kind of running code, in the order facts are read. */
export const RUNNING_SUBJECTS: RunningSubject[] = [
  "native",
  "bundle",
  "web",
  "worker",
];
