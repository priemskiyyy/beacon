import type { MockSourceStats } from "src/mock/types/MockSourceStats";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { SourceRead } from "src/types/SourceRead";
import type { SourceReadContext } from "src/types/SourceReadContext";

/**
 * A scriptable release source for tests. Reads are held until the test settles
 * them, or answered at once after `answer`. It can settle a read late, after
 * the read was aborted, which a real source may do too.
 *
 * @example
 * ```ts
 * const mock = createMockSource<Manifest>();
 * const web = mock.source.select((manifest) => manifest.web);
 *
 * mock.resolve({ document: manifest });
 * ```
 */
export type MockSource<TDocument> = {
  source: ReleaseSource<TDocument>;
  /** Answers every read from now on with this answer, until `hold` or another answer. */
  answer: (read: SourceRead<TDocument>) => void;
  /** Holds every read from now on until the test settles it. */
  hold: () => void;
  /** Settles the oldest held read with an answer. */
  resolve: (read: SourceRead<TDocument>) => void;
  /** Settles the oldest held read with a failure. */
  reject: (error: Error) => void;
  /** The context of every read Beacon started, oldest first. */
  contexts: () => SourceReadContext[];
  stats: () => MockSourceStats;
};
