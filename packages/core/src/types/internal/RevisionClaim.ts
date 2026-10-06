import type { DecisionRevision } from "src/types/DecisionRevision";

/** A decision's revision with the fingerprint of its semantic content. */
export type RevisionClaim = {
  revision: DecisionRevision | null;
  /** Identifies the decision without its renewable envelope, or `null` when the source gives none. */
  digest: string | null;
};
