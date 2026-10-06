import type { RunningReader } from "src/types/RunningReader";
import type { RunningSubject } from "src/types/RunningSubject";

/**
 * Where the running facts come from: at most one reader per subject, so no two
 * authorities can disagree, and a reader made for one subject does not fit
 * another. A subject needs a reader when a route compares an offer with it, and
 * a driver route may supply the reader of its own subject unless you pass one.
 * `boot.id` names this executing document or JavaScript runtime, minted once
 * per runtime rather than per build. Leave it out and every Beacon of the
 * runtime shares one minted by `createBootId()`, which is what a boot is; pass
 * it to choose the id, as a test does.
 *
 * @example
 * ```ts
 * const running: RunningReaders = { web: readWebRelease };
 * ```
 */
export type RunningReaders = { boot?: { id: string } } & {
  [TSubject in RunningSubject]?: RunningReader<TSubject>;
};
