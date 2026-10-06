import type { JournalStorage } from "src/types/JournalStorage";
import type { KeyValueStoreLike } from "src/types/KeyValueStoreLike";

/**
 * Turns the transition journal on. Before a command that replaces the
 * realm, Beacon writes an intent, which is not proof that the dispatch
 * happened. With `best-effort`, the default, a failed write is visible and the
 * command goes on without a durable correlation. With `required`, a failed
 * write prevents the command. A storage that does not answer within
 * `timeouts.journal` counts as failed, so it cannot hold a command forever.
 * Neither proves storage survives a device failure or tampering.
 *
 * `storage` is a `JournalStorage`, or a key-value store with `getItem`,
 * `setItem` and `removeItem`, such as AsyncStorage, `expo-sqlite/kv-store`,
 * `localStorage` or `sessionStorage`, which Beacon wraps with
 * `keyValueJournalStorage` and its read-back of every write. Wrap it yourself
 * to pass `verify` or `key`.
 *
 * `budget` and `retention` are advanced: leave them out unless a policy of
 * your own reads `exhausted` or must keep intents for longer or shorter than
 * a day.
 *
 * @example
 * ```ts
 * // AsyncStorage, `expo-sqlite/kv-store`, `localStorage`, or any store with these three calls.
 * declare const store: KeyValueStoreLike;
 *
 * const journal: JournalOptions = { storage: store };
 *
 * const strict: JournalOptions = {
 *   mode: "required",
 *   storage: keyValueJournalStorage(store, { verify: false }),
 * };
 * ```
 */
export type JournalOptions = {
  /** `best-effort` unless it says `required`. */
  mode?: "best-effort" | "required";
  storage: JournalStorage | KeyValueStoreLike;
  /** Advanced. How many boots in a row may leave a target unreached before `exhausted` says so, 3 by default. */
  budget?: number;
  /** Advanced. Milliseconds an intent is kept, a day by default. */
  retention?: number;
};
