import type { Evidence } from "src/types/Evidence";
import type { RevisionClaim } from "src/types/internal/RevisionClaim";

/** The document a feed holds, and everything that backs it. Replaced whole, never edited. */
export type AcceptedFeed = {
  document: unknown;
  claim: RevisionClaim;
  evidence: Evidence;
  /** The attempt that produced it. */
  attempt: number;
};
