import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningFact } from "src/types/RunningFact";
import type { RunningRelease } from "src/types/RunningRelease";

const isSameIdentity = (left: ReleaseIdentity, right: ReleaseIdentity) => {
  if (left.status === "unknown" && right.status === "unknown") {
    return left.reason === right.reason;
  }

  if (left.status === "known" && right.status === "known") {
    return (
      left.authority === right.authority &&
      left.domain === right.domain &&
      left.value === right.value
    );
  }

  return false;
};

const isSameRelease = (left: RunningRelease, right: RunningRelease) => {
  if (left.label !== right.label) {
    return false;
  }

  if (!isSameIdentity(left.identity, right.identity)) {
    return false;
  }

  const leftKeys = Object.keys(left.raw);
  const rightKeys = Object.keys(right.raw);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left.raw[key] === right.raw[key]);
};

/** Whether a new fact adds nothing to the one held; when it was read does not count. */
export const isSameRunningFact = (held: RunningFact, next: RunningFact) => {
  if (held.state === "known" && next.state === "known") {
    return isSameRelease(held.release, next.release);
  }

  if (held.state === "failed" && next.state === "failed") {
    return held.error.code === next.error.code;
  }

  return held.state === next.state;
};
