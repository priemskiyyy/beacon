import type { JournalStorage } from "src/types/JournalStorage";

/** The journal options once validated and defaulted, so the journal never checks them again. */
export type ResolvedJournalOptions = {
  mode: "best-effort" | "required";
  /** Always the journal's own storage: a key-value store was wrapped when the options were resolved. */
  storage: JournalStorage;
  /** Boots in a row that may leave a target unreached. */
  budget: number;
  /** Milliseconds an intent is kept. */
  retention: number;
  /** Milliseconds a call to the storage may take. */
  timeout: number;
};
