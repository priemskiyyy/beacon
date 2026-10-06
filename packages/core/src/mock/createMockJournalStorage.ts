import { createGate } from "src/mock/createGate";
import type { MockJournalStorage } from "src/mock/types/MockJournalStorage";

/**
 * An in-memory `JournalStorage` for tests, with knobs: hold or refuse the
 * reads and the writes, count them, and look at what was stored. A write that
 * resolves is stored, as a required journal demands.
 *
 * @example
 * ```ts
 * const storage = createMockJournalStorage();
 *
 * storage.failWrites(new Error("quota exceeded"));
 *
 * const journal = { mode: "required", storage } satisfies JournalOptions;
 * ```
 */
export const createMockJournalStorage = (): MockJournalStorage => {
  const records = new Map<string, string>();
  const calls = { reads: 0, writes: 0 };

  const failures: { read: Error | null; write: Error | null } = {
    read: null,
    write: null,
  };

  const readGate = createGate();
  const writeGate = createGate();

  return {
    records,
    read: async (key) => {
      calls.reads += 1;

      if (failures.read !== null) {
        throw failures.read;
      }

      await readGate.wait();

      return records.get(key) ?? null;
    },
    write: async (key, value) => {
      calls.writes += 1;

      await writeGate.wait();

      if (failures.write !== null) {
        throw failures.write;
      }

      records.set(key, value);
    },
    remove: async (key) => {
      records.delete(key);
    },
    reads: () => calls.reads,
    writes: () => calls.writes,
    holdReads: readGate.hold,
    releaseReads: readGate.release,
    holdWrites: writeGate.hold,
    releaseWrites: writeGate.release,
    failReads: (
      error: Error | null = new Error("The storage refused the read."),
    ) => {
      failures.read = error;
    },
    failWrites: (
      error: Error | null = new Error("The storage refused the write."),
    ) => {
      failures.write = error;
    },
  };
};
