import type { RunningReader } from "src/types/RunningReader";

/**
 * Where the running facts come from. `boot.id` names this executing document
 * or JavaScript runtime, minted once per runtime rather than per build, and
 * each subject has at most one reader, so no two authorities can disagree.
 *
 * @example
 * ```ts
 * const running: RunningReaders = { boot: { id: BOOT_ID }, web: readWebRelease };
 * ```
 */
export type RunningReaders = {
  boot: { id: string };
  native?: RunningReader;
  bundle?: RunningReader;
  web?: RunningReader;
  worker?: RunningReader;
};
