import type { RunningSubject } from "@priemskiyyy/beacon";

// A record makes the compiler name every subject, so a new one cannot be left out.
const NAMES: Record<RunningSubject, RunningSubject> = {
  native: "native",
  bundle: "bundle",
  web: "web",
  worker: "worker",
};

/** Every running subject, by the text a manifest writes for it. */
export const SUBJECTS = new Map<string, RunningSubject>(
  Object.values(NAMES).map((subject) => [subject, subject]),
);
