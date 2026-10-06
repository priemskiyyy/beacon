import type { ReconciliationOutcome } from "src/types/ReconciliationOutcome";
import type { TransitionIntent } from "src/types/TransitionIntent";

/**
 * An intent as the journal keeps it: `outcome` is `null` while no later boot
 * has looked at it, and `attempts` counts the boots in a row that left its
 * target unreached, itself included.
 */
export type StoredTransition = {
  intent: TransitionIntent;
  outcome: ReconciliationOutcome | null;
  attempts: number;
};
