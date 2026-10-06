import type { JournalStorage } from "@priemskiyyy/beacon";

/**
 * The key-value store the journal adapts: AsyncStorage, `expo-sqlite/kv-store`
 * and any other whose three calls return promises. A write that resolves must
 * mean the value was persisted, which is what these stores answer.
 */
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** The journal's storage over a key-value store, for a runtime that is replaced by the reload it records. */
export const createJournalStorage = (store: KeyValueStore): JournalStorage => ({
  read: (key) => store.getItem(key),
  write: (key, value) => store.setItem(key, value),
  remove: (key) => store.removeItem(key),
});
