import type { RunningSubject } from "src/types/RunningSubject";

/** What a newcomer can pass for a subject, named in the error of a feed route that has no reader for it. The bundle has none: a driver route supplies its own, so a feed route of that subject is the application's own source and mechanism, and so is its reader. The worker subject has no adapter reader either. */
export const READER_HINTS: Partial<Record<RunningSubject, string>> = {
  native: "expoApplication({ application })",
  web: "webBuild({ id })",
};
