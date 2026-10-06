/** The version of the record layout. A record of another version is ignored, never executed. */
export const JOURNAL_VERSION = 1;

/** How many boots in a row may leave a target unreached before the budget is spent. */
export const DEFAULT_JOURNAL_BUDGET = 3;

/** Milliseconds an intent is kept: a day. */
export const DEFAULT_JOURNAL_RETENTION = 86_400_000;

/** How many transitions a record keeps; older correlation is lost, visibly, past this. */
export const JOURNAL_CAPACITY = 8;

/** The namespace of every key the journal writes. */
export const JOURNAL_NAMESPACE = "beacon";

/** The checkpoint `reportReady` records when the application names none. */
export const DEFAULT_CHECKPOINT = "ready";
