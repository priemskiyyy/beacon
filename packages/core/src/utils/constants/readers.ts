import type { RunningSubject } from "src/types/RunningSubject";

/** What a newcomer can pass for a subject, named in the error of a route that has no reader for it. The worker subject has no adapter reader, so the application writes its own. */
export const READER_HINTS: Partial<Record<RunningSubject, string>> = {
  native: "expoApplication({ application })",
  bundle: "expoBundle({ updates })",
  web: "webBuild({ id })",
};
