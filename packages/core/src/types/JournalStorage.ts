/**
 * The minimal storage a journal needs, as strings under keys. The application
 * adapts whatever it has: a key-value store, `localStorage`, a file. A write
 * that resolves must mean the value was persisted, not merely queued, since a
 * required journal treats anything else as a failure. It is not atomic across
 * tabs or runtimes, and no counter here pretends to be.
 *
 * @example
 * ```ts
 * const storage: JournalStorage = {
 *   read: async (key) => localStorage.getItem(key),
 *   write: async (key, value) => localStorage.setItem(key, value),
 *   remove: async (key) => localStorage.removeItem(key),
 * };
 * ```
 */
export type JournalStorage = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};
