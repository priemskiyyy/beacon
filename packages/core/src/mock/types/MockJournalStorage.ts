import type { JournalStorage } from "src/types/JournalStorage";

/**
 * An in-memory journal storage for tests. It keeps what the journal writes in
 * `records`, counts the reads and writes it is asked for, and can hold or
 * refuse them, so a test decides what interleaves with a write and what
 * happens when one fails. Nothing answers late by itself: a held call waits
 * until the test releases it.
 *
 * @example
 * ```ts
 * const storage = createMockJournalStorage();
 * const beacon = new Beacon({
 *   scope,
 *   running,
 *   routes,
 *   journal: { mode: "required", storage },
 * });
 *
 * storage.holdWrites();
 * ```
 */
export type MockJournalStorage = JournalStorage & {
  /** What is stored, by key: a test seeds the record an earlier boot left, and reads what the journal wrote. */
  records: Map<string, string>;
  /** How many reads the journal has made, those held and those refused included. */
  reads: () => number;
  /** How many writes the journal has made, those held and those refused included. */
  writes: () => number;
  /** Holds every read from now on until `releaseReads`. */
  holdReads: () => void;
  /** Lets every held read go, and stops holding. */
  releaseReads: () => void;
  /** Holds every write from now on until `releaseWrites`. */
  holdWrites: () => void;
  /** Lets every held write go, and stops holding. */
  releaseWrites: () => void;
  /** Refuses every read from now on with this error, or a default one, until `failReads(null)`. */
  failReads: (error?: Error | null) => void;
  /** Refuses every write from now on with this error, or a default one, until `failWrites(null)`. */
  failWrites: (error?: Error | null) => void;
};
