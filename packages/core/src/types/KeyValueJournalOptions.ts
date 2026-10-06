/**
 * How `keyValueJournalStorage` treats its store.
 *
 * @example
 * ```ts
 * const options: KeyValueJournalOptions = {
 *   verify: false,
 *   key: (journalKey) => journalKey.replaceAll("/", "."),
 * };
 * ```
 */
export type KeyValueJournalOptions = {
  /**
   * Reads the record back after every write, and fails the write when the
   * store shows something else. A store that accepts a write and keeps nothing
   * would otherwise let a `required` journal dispatch a reload on an intent
   * that was never kept. It costs one more read per write, and is on by
   * default.
   */
  verify?: boolean;
  /**
   * Maps a journal key to the store's own, for a store whose keys have a
   * narrower alphabet than `beacon/v1/<application>/...`. It must be
   * injective: two journal keys that map to one would make two scopes share a
   * record.
   */
  key?: (journalKey: string) => string;
};
