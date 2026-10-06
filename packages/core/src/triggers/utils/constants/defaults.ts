import type { CheckReason } from "src/types/CheckReason";

/** The least time between two starts of a check. */
export const MIN_INTERVAL = 5_000;

/** The share of a backoff wait that is added at random, so that a fleet that failed together does not retry in step. */
export const BACKOFF_JITTER = 0.2;

/** The retries the gate starts by itself after a failure. */
export const BACKOFF_ATTEMPTS = 3;

/** The reasons a fresh answer makes unnecessary: a return and a timer ask again without knowing anything changed. A startup, a reconnect and an invalidation say something did, and a retry follows a check that failed to renew the answer. */
export const SKIPPED_WHILE_FRESH = new Set<CheckReason>([
  "foreground",
  "interval",
]);
