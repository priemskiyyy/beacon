import type { RunningReader } from "src/types/RunningReader";
import type { RunningSubject } from "src/types/RunningSubject";

/**
 * Where the running facts come from. `boot.id` names this executing document
 * or JavaScript runtime, minted once per runtime rather than per build, for
 * which `createBootId()` is made, and each subject has at most one reader, so
 * no two authorities can disagree.
 *
 * @example
 * ```ts
 * const running: RunningReaders = { boot: { id: createBootId() }, web: readWebRelease };
 * ```
 */
export type RunningReaders = { boot: { id: string } } & Partial<
  Record<RunningSubject, RunningReader>
>;
