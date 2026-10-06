import type { RevisionClaim } from "src/types/internal/RevisionClaim";
import type { RevisionVerdict } from "src/types/internal/RevisionVerdict";
import { CANONICAL_DECIMAL_PATTERN } from "src/utils/constants/versions";
import { compareDecimals } from "src/utils/internal/versions/compareDecimals";

const ACCEPTED: RevisionVerdict = { status: "accepted" };

const isConflicting = (held: RevisionClaim, incoming: RevisionClaim) => {
  if (held.digest === null || incoming.digest === null) {
    return false;
  }

  return held.digest !== incoming.digest;
};

// The same revision again: a conflict when both sides can say their content differs, a renewal otherwise.
const judgeSameRevision = (
  held: RevisionClaim,
  incoming: RevisionClaim,
): RevisionVerdict => {
  if (isConflicting(held, incoming)) {
    return { status: "rejected", code: "REVISION_CONFLICT" };
  }

  return { status: "renewed", digest: incoming.digest ?? held.digest };
};

/**
 * Judges an incoming decision against the one held. An ordered revision must
 * be a canonical decimal, and may only advance within its domain and epoch;
 * the same revision may only renew the same decision, and a change of epoch is
 * never assumed to be newer.
 */
export const judgeRevision = (
  held: RevisionClaim | null,
  incoming: RevisionClaim,
): RevisionVerdict => {
  if (
    incoming.revision?.kind === "ordered" &&
    !CANONICAL_DECIMAL_PATTERN.test(incoming.revision.value)
  ) {
    return { status: "rejected", code: "INVALID_DOCUMENT" };
  }

  if (held === null || held.revision === null) {
    return ACCEPTED;
  }

  if (incoming.revision === null) {
    return { status: "rejected", code: "REVISION_REGRESSION" };
  }

  if (held.revision.kind === "opaque" && incoming.revision.kind === "opaque") {
    if (held.revision.value !== incoming.revision.value) {
      return ACCEPTED;
    }

    return judgeSameRevision(held, incoming);
  }

  if (
    held.revision.kind === "ordered" &&
    incoming.revision.kind === "ordered"
  ) {
    if (
      held.revision.domain !== incoming.revision.domain ||
      held.revision.epoch !== incoming.revision.epoch
    ) {
      return { status: "rejected", code: "REVISION_EPOCH_CHANGED" };
    }

    const ordering = compareDecimals(
      incoming.revision.value,
      held.revision.value,
    );

    if (ordering === "newer") {
      return ACCEPTED;
    }

    if (ordering === "older") {
      return { status: "rejected", code: "REVISION_REGRESSION" };
    }

    return judgeSameRevision(held, incoming);
  }

  return { status: "rejected", code: "REVISION_EPOCH_CHANGED" };
};
