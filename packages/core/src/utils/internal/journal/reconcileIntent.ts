import type { ReconciliationOutcome } from "src/types/ReconciliationOutcome";
import type { RunningApplication } from "src/types/RunningApplication";
import type { TransitionIntent } from "src/types/TransitionIntent";
import { compareIdentities } from "src/utils/compareIdentities";

/**
 * What the running facts say about an earlier intent. In the same boot nothing
 * new was observed, so the action may still be unresolved. In a new boot, the
 * subject's identity is compared with the target and with what ran before. An
 * identity that is unknown or of another domain is inconclusive, and a match of
 * labels alone never matches. Nothing here claims what caused the outcome.
 */
export const reconcileIntent = (
  intent: TransitionIntent,
  running: RunningApplication,
): ReconciliationOutcome => {
  if (intent.boot.id === running.boot.id) {
    return "same-boot";
  }

  const fact = running[intent.subject];

  if (fact.state !== "known") {
    return "inconclusive";
  }

  const now = fact.release.identity;

  if (
    intent.target !== null &&
    compareIdentities(now, intent.target) === "same"
  ) {
    return "target-running";
  }

  if (
    intent.current !== null &&
    compareIdentities(now, intent.current) === "same"
  ) {
    return "target-not-running";
  }

  if (intent.target === null) {
    return "inconclusive";
  }

  if (compareIdentities(now, intent.target) === "different") {
    return "different-target";
  }

  return "inconclusive";
};
