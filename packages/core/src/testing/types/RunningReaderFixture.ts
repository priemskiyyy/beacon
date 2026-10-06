import type { RunningReader } from "src/types/RunningReader";

/**
 * A running reader under test, over a fake of its host made for this test
 * alone: the reader, and how many times it has asked that host. A reader with
 * no host to ask, such as one over a constant the build defines, has none to
 * count and leaves `reads` out.
 *
 * @example
 * ```ts
 * let asked = 0;
 * const fixture: RunningReaderFixture = {
 *   reader: () => {
 *     asked += 1;
 *
 *     return { identity: { status: "unknown", reason: "not-reported" }, label: null, raw: {} };
 *   },
 *   reads: () => asked,
 * };
 * ```
 */
export type RunningReaderFixture = {
  reader: RunningReader;
  /** How many times the reader has asked its host. */
  reads?: () => number;
};
