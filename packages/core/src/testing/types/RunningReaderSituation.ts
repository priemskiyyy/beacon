import type { RunningReaderFixture } from "src/testing/types/RunningReaderFixture";
import type { ReleaseScope } from "src/types/ReleaseScope";

/**
 * A state of the fake host other than the usual one, such as a build it cannot
 * name, with what the reader must answer in it: a known identity, an unknown
 * one with a reason, or a rejection, which Beacon publishes as a failed fact.
 * When the scope is what makes the host unable to name the build, such as a
 * platform the reader does not know, the situation gives its own.
 *
 * @example
 * ```ts
 * const situation: RunningReaderSituation = {
 *   name: "the host cannot name the build",
 *   answers: "unknown",
 *   create: () => ({
 *     reader: () => ({
 *       identity: { status: "unknown", reason: "build-not-read" },
 *       label: null,
 *       raw: {},
 *     }),
 *   }),
 * };
 * ```
 */
export type RunningReaderSituation = {
  name: string;
  answers: "known" | "unknown" | "rejection";
  /** The scope this situation reads under, instead of the suite's. */
  scope?: ReleaseScope;
  create: () => RunningReaderFixture;
};
