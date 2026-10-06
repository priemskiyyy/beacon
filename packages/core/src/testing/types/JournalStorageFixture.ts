import type { JournalStorage } from "src/types/JournalStorage";

/**
 * A journal storage under test, over a backend made for this test alone: the
 * storage, and optionally how to open another one over the same backend, as
 * the application does after a restart. Give `reopen` for a backend that
 * persists, so the suite checks that what was written is still there.
 *
 * @example
 * ```ts
 * const storage = createMockJournalStorage();
 * const fixture: JournalStorageFixture = { storage, reopen: () => storage };
 * ```
 */
export type JournalStorageFixture = {
  storage: JournalStorage;
  reopen?: () => JournalStorage | Promise<JournalStorage>;
};
