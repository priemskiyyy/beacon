import type { ReconciliationOutcome } from "src/types/ReconciliationOutcome";
import type { TransitionIntent } from "src/types/TransitionIntent";

/**
 * An intent, what the running facts say about it, and how many boots in a row
 * have left the same target unreached, this one included once it is known to
 * have. `judgedHere` is true only while this boot is the one that judged the
 * intent, so a banner says "Updated." once and not on every later boot that
 * reads the same record; it lives in memory and adds nothing to the record.
 * `exhausted` says the attempt budget is spent: an automatic action should
 * stop, and a manual one can ask the user to acknowledge.
 *
 * @example
 * ```ts
 * const { latest } = beacon.transitions.get();
 *
 * if (latest?.judgedHere && latest.outcome === "target-running") {
 *   console.info("Updated.");
 * }
 * ```
 */
export type Reconciliation = {
  intent: TransitionIntent;
  outcome: ReconciliationOutcome;
  attempts: number;
  judgedHere: boolean;
  exhausted: boolean;
};
