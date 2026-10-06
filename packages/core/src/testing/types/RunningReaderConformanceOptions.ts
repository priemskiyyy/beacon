import type { RunningReaderFixture } from "src/testing/types/RunningReaderFixture";
import type { RunningReaderSituation } from "src/testing/types/RunningReaderSituation";

/**
 * What a running reader's conformance suite is run over: a name for the
 * report, a `create` that makes a fixture for every test in the usual state,
 * where the host can name what runs, and the other states of the host the
 * reader must answer for.
 *
 * @example
 * ```ts
 * const reader: RunningReader = () => ({
 *   identity: {
 *     status: "known",
 *     authority: "com.example.notes",
 *     domain: "web-artifact",
 *     value: "build-a",
 *   },
 *   label: null,
 *   raw: {},
 * });
 * const options: RunningReaderConformanceOptions = {
 *   name: "web build",
 *   create: () => ({ reader }),
 * };
 * ```
 */
export type RunningReaderConformanceOptions = {
  name: string;
  create: () => RunningReaderFixture;
  situations?: RunningReaderSituation[];
};
