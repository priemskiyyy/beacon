import type { JournalStorage } from "src/types/JournalStorage";
import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { TransitionIntent } from "src/types/TransitionIntent";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";
import { SCOPE } from "src/utils/Beacon.fixture";
import { createDeferred } from "src/utils/internal/common/createDeferred";

export const KEY = createJournalKey(SCOPE);

// A journal storage whose answers a test scripts, and whose calls it counts.
export const createMemoryStorage = () => {
  const data = new Map<string, string>();
  const calls = { reads: 0, writes: 0, removes: 0 };

  const failures: { write: Error | null; read: Error | null } = {
    write: null,
    read: null,
  };

  const holds: Array<ReturnType<typeof createDeferred<void>>> = [];
  const writeHolds: Array<ReturnType<typeof createDeferred<void>>> = [];
  const state = { holding: false, holdingWrites: false };

  const storage: JournalStorage = {
    read: async (key) => {
      calls.reads += 1;

      if (failures.read !== null) {
        throw failures.read;
      }

      if (state.holding) {
        const hold = createDeferred<void>();

        holds.push(hold);
        await hold.promise;
      }

      return data.get(key) ?? null;
    },
    write: async (key, value) => {
      calls.writes += 1;

      if (state.holdingWrites) {
        const hold = createDeferred<void>();

        writeHolds.push(hold);
        await hold.promise;
      }

      if (failures.write !== null) {
        throw failures.write;
      }

      data.set(key, value);
    },
    remove: async (key) => {
      calls.removes += 1;
      data.delete(key);
    },
  };

  return {
    storage,
    data,
    calls,
    failWrites: (error: Error | null) => {
      failures.write = error;
    },
    failReads: (error: Error | null) => {
      failures.read = error;
    },
    holdReads: () => {
      state.holding = true;
    },
    holdWrites: () => {
      state.holdingWrites = true;
    },
    releaseWrites: () => {
      state.holdingWrites = false;

      for (const hold of writeHolds.splice(0)) {
        hold.resolve();
      }
    },
    releaseReads: () => {
      state.holding = false;

      for (const hold of holds.splice(0)) {
        hold.resolve();
      }
    },
  };
};

export const buildIntent = (
  overrides: Partial<TransitionIntent> = {},
): TransitionIntent => ({
  operation: { id: 1 },
  boot: { id: "boot-1" },
  route: "web",
  command: "reload",
  subject: "web",
  current: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value: "web-build-b",
  },
  target: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value: "web-build-a",
  },
  binding: "unpinned-navigation",
  createdAt: 1_000,
  expiresAt: 87_401_000,
  ...overrides,
});

export const buildStored = (
  intent: TransitionIntent,
  outcome: StoredTransition["outcome"] = null,
  attempts = 0,
): StoredTransition => ({ intent, outcome, attempts });

/** Puts a record in storage as an earlier boot left it. */
export const seed = (
  memory: ReturnType<typeof createMemoryStorage>,
  transitions: StoredTransition[],
) => {
  memory.data.set(KEY, serializeJournal(transitions));
};
