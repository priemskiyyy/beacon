import type { StoredTransition } from "src/types/internal/StoredTransition";
import { JOURNAL_VERSION } from "src/utils/constants/journal";

/** The record for a list of transitions: versioned, bounded by the caller, and holding nothing but the plain data of each. */
export const serializeJournal = (transitions: StoredTransition[]) =>
  JSON.stringify({ version: JOURNAL_VERSION, transitions });
