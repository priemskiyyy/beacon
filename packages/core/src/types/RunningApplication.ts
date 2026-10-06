import type { RunningFact } from "src/types/RunningFact";
import type { RunningSubject } from "src/types/RunningSubject";

/**
 * The composite of what is executing: a fact for each subject. It grows a
 * `revision` with every change of a fact, and only a local reader changes one:
 * an offer, a download or a reload request never does.
 *
 * @example
 * ```ts
 * const { boot, native } = beacon.running.get();
 * ```
 */
export type RunningApplication = {
  boot: { id: string };
  revision: number;
} & Record<RunningSubject, RunningFact>;
