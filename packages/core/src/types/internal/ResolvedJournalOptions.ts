import type { JournalStorage } from "src/types/JournalStorage";

/** The journal options once validated and defaulted, so the journal never checks them again. */
export type ResolvedJournalOptions = {
  mode: "best-effort" | "required";
  storage: JournalStorage;
  /** Boots in a row that may leave a target unreached. */
  budget: number;
  /** Milliseconds an intent is kept. */
  retention: number;
};
