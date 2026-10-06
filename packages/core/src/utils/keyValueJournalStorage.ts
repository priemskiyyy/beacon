import type { JournalStorage } from "src/types/JournalStorage";
import type { KeyValueJournalOptions } from "src/types/KeyValueJournalOptions";
import type { KeyValueStoreLike } from "src/types/KeyValueStoreLike";

const keepKey = (journalKey: string) => journalKey;

/**
 * The journal's storage over any store with `getItem`, `setItem` and
 * `removeItem`, such as AsyncStorage, `expo-sqlite/kv-store`, `localStorage` or
 * `sessionStorage`. A call that throws at once, such as a full `localStorage`,
 * becomes a rejection, a key nothing was written under reads `null`, and a
 * write resolves only after the store showed the record back, which
 * `verify: false` turns off. A store that hangs is given up on by
 * `timeouts.journal`.
 *
 * The record lives under the journal's own key, which names the scope and the
 * partition in plain text, and the store keeps it as long as it keeps anything.
 * Clear the journal before `replaceScope` on a sign-out.
 *
 * @example
 * ```ts
 * // AsyncStorage, `expo-sqlite/kv-store`, or any store with these three calls.
 * declare const store: KeyValueStoreLike;
 *
 * const journal = {
 *   mode: "required",
 *   storage: keyValueJournalStorage(store),
 * } satisfies JournalOptions;
 * ```
 */
export const keyValueJournalStorage = (
  store: KeyValueStoreLike,
  { verify = true, key: toStoreKey = keepKey }: KeyValueJournalOptions = {},
): JournalStorage => ({
  read: async (journalKey) => {
    const text = await store.getItem(toStoreKey(journalKey));

    return text ?? null;
  },
  write: async (journalKey, value) => {
    const storeKey = toStoreKey(journalKey);

    await store.setItem(storeKey, value);

    if (!verify) {
      return;
    }

    const kept = await store.getItem(storeKey);

    if (kept === value) {
      return;
    }

    throw new Error("The store accepted the record and did not keep it.");
  },
  remove: async (journalKey) => {
    await store.removeItem(toStoreKey(journalKey));
  },
});
