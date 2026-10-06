import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { TransitionIntent } from "src/types/TransitionIntent";

const freezeIdentity = (identity: ReleaseIdentity | null) => {
  if (identity === null) {
    return null;
  }

  return Object.freeze({ ...identity });
};

/** A copy nobody can change once it is published, since the record is written from the very object that was published. */
export const freezeIntent = (intent: TransitionIntent): TransitionIntent =>
  Object.freeze({
    ...intent,
    operation: Object.freeze({ ...intent.operation }),
    boot: Object.freeze({ ...intent.boot }),
    current: freezeIdentity(intent.current),
    target: freezeIdentity(intent.target),
  });
