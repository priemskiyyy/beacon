import type { JournalStorage } from "@priemskiyyy/beacon";

/**
 * The journal's storage, in memory and shared by every document of the lab, as
 * `localStorage` would be by every load of a page. A real application persists
 * across restarts here; this one persists across the lab's simulated boots.
 */
export const createJournalStorage = (
  records: Map<string, string>,
): JournalStorage => ({
  read: async (key) => records.get(key) ?? null,
  write: async (key, value) => {
    records.set(key, value);
  },
  remove: async (key) => {
    records.delete(key);
  },
});
