import type { JournalStorage } from "@priemskiyyy/beacon";

export type FakeStorage = JournalStorage & {
  writes: () => number;
  holdWrites: () => void;
  releaseWrites: () => void;
  failWrites: () => void;
};

// A journal storage that counts its writes and can hold or refuse them, so a test can prove what happens before one lands.
export const fakeStorage = (): FakeStorage => {
  const values = new Map<string, string>();
  const held: Array<() => void> = [];
  const state = { holding: false, failing: false, writes: 0 };

  return {
    read: async (key) => values.get(key) ?? null,
    write: async (key, value) => {
      state.writes += 1;

      if (state.holding) {
        await new Promise<void>((resolve) => {
          held.push(resolve);
        });
      }

      if (state.failing) {
        throw new Error("storage refused");
      }

      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
    writes: () => state.writes,
    holdWrites: () => {
      state.holding = true;
    },
    releaseWrites: () => {
      state.holding = false;

      for (const resolve of held.splice(0)) {
        resolve();
      }
    },
    failWrites: () => {
      state.failing = true;
    },
  };
};
