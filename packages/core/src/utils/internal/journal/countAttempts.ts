import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { TransitionIntent } from "src/types/TransitionIntent";

// The same attempt is the same command on the same route at the same target: a new deployment decision names another target.
const isSameAttempt = (left: TransitionIntent, right: TransitionIntent) => {
  if (left.route !== right.route || left.command !== right.command) {
    return false;
  }

  if (left.target === null || right.target === null) {
    return left.target === right.target;
  }

  if (left.target.status === "unknown" || right.target.status === "unknown") {
    return false;
  }

  return (
    left.target.authority === right.target.authority &&
    left.target.domain === right.target.domain &&
    left.target.value === right.target.value
  );
};

/**
 * How many boots in a row, before the intent's own, have left this target
 * unreached. Only an unreached target counts, and any other outcome, or
 * another target, starts the count again, so a legitimate new decision is
 * never charged for an old one. Several intents of one boot are one boot, and
 * an intent of the boot being judged is not an earlier one.
 */
export const countAttempts = (
  intent: TransitionIntent,
  history: StoredTransition[],
) => {
  const boots = new Set<string>();

  for (const earlier of [...history].reverse()) {
    if (earlier.intent.boot.id === intent.boot.id) {
      continue;
    }

    if (earlier.outcome !== "target-not-running") {
      break;
    }

    if (!isSameAttempt(earlier.intent, intent)) {
      break;
    }

    boots.add(earlier.intent.boot.id);
  }

  return boots.size;
};
