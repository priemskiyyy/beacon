import type { RevisionClaim } from "src/types/internal/RevisionClaim";
import type { RevisionVerdict } from "src/types/internal/RevisionVerdict";
import { compareDecimals } from "src/utils/internal/versions/compareDecimals";

const RENEWED: RevisionVerdict = { status: "renewed" };

const ACCEPTED: RevisionVerdict = { status: "accepted" };

const isConflicting = (held: RevisionClaim, incoming: RevisionClaim) => {
  if (held.digest === null || incoming.digest === null) {
    return false;
  }

  return held.digest !== incoming.digest;
};

/**
 * Judges an incoming decision against the one held. An ordered revision may
 * only advance within its domain and epoch, the same revision may only renew
 * the same decision, and a change of epoch is never assumed to be newer.
 */
export const judgeRevision = (
  held: RevisionClaim | null,
  incoming: RevisionClaim,
): RevisionVerdict => {
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

    if (isConflicting(held, incoming)) {
      return { status: "rejected", code: "REVISION_CONFLICT" };
    }

    return RENEWED;
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

    if (isConflicting(held, incoming)) {
      return { status: "rejected", code: "REVISION_CONFLICT" };
    }

    return RENEWED;
  }

  return { status: "rejected", code: "REVISION_EPOCH_CHANGED" };
};
