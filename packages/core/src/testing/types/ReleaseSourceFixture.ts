import type { ReleaseSource } from "src/types/ReleaseSource";

/**
 * A source under test, over a fake backend created for this test alone: the
 * source, and how many requests it has made of that backend.
 *
 * @example
 * ```ts
 * const backend = fakeBackend();
 * const fixture: ReleaseSourceFixture<Manifest> = {
 *   source: http({ request: backend.request }),
 *   reads: backend.reads,
 * };
 * ```
 */
export type ReleaseSourceFixture<TDocument> = {
  source: ReleaseSource<TDocument>;
  /** How many requests the source has made of its backend. */
  reads: () => number;
};
