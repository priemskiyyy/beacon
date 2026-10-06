import type { RunningReader } from "src/types/RunningReader";
import type { RunningSubject } from "src/types/RunningSubject";

/** The readers a Beacon runs on after the defaults are in: the boot id it has, and at most one reader per subject. */
export type ResolvedRunningReaders = { boot: { id: string } } & Partial<
  Record<RunningSubject, RunningReader<RunningSubject>>
>;
