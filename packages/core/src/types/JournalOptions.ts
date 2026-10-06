import type { JournalStorage } from "src/types/JournalStorage";

/**
 * Turns the transition journal on. Before a command that replaces the
 * realm, Beacon writes an intent, which is not proof that the dispatch
 * happened. With `best-effort`, a failed write is visible and the command goes
 * on without a durable correlation. With `required`, a failed write prevents
 * the command. A storage that does not answer within `timeouts.journal` counts
 * as failed, so it cannot hold a command forever. Neither proves storage
 * survives a device failure or tampering.
 *
 * @example
 * ```ts
 * const journal: JournalOptions = { mode: "required", storage, budget: 2 };
 * ```
 */
export type JournalOptions = {
  mode: "best-effort" | "required";
  storage: JournalStorage;
  /** How many boots in a row may leave a target unreached before `exhausted` says so, 3 by default. */
  budget?: number;
  /** Milliseconds an intent is kept, a day by default. */
  retention?: number;
};
