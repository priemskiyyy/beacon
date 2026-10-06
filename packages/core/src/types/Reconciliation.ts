import type { ReconciliationOutcome } from "src/types/ReconciliationOutcome";
import type { TransitionIntent } from "src/types/TransitionIntent";

/**
 * An intent, what the running facts say about it, and how many boots in a row
 * have left the same target unreached, this one included once it is known to
 * have. `exhausted` says the attempt budget is spent: an automatic action
 * should stop, and a manual one can ask the user to acknowledge.
 *
 * @example
 * ```ts
 * const { latest } = beacon.transitions.get();
 *
 * if (latest?.exhausted) {
 *   console.warn("The same reload keeps landing on the same build.");
 * }
 * ```
 */
export type Reconciliation = {
  intent: TransitionIntent;
  outcome: ReconciliationOutcome;
  attempts: number;
  exhausted: boolean;
};
