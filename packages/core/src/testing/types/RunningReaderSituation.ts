import type { RunningReaderFixture } from "src/testing/types/RunningReaderFixture";

/**
 * A state of the fake host other than the usual one, such as a build it cannot
 * name, with what the reader must answer in it: a known identity, an unknown
 * one with a reason, or a rejection, which Beacon publishes as a failed fact.
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
  create: () => RunningReaderFixture;
};
