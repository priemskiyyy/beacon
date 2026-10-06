import type { Evidence } from "src/types/Evidence";
import type { RemediationState } from "src/types/RemediationState";
import type { SupportReason } from "src/types/SupportReason";
import type { SupportStatus } from "src/types/SupportStatus";

/**
 * One evaluation of the policy: its verdict, the routes that would satisfy it,
 * the revision of the running facts it was first reached under, and the
 * evidence of the policy it evaluated. A change to a fact the verdict does not
 * depend on evaluates to the same thing and keeps the snapshot, so a gate
 * does not reset.
 *
 * @example
 * ```ts
 * const { evaluation } = beacon.support.get();
 * ```
 */
export type SupportEvaluation = {
  status: SupportStatus;
  reasons: SupportReason[];
  remediation: RemediationState[];
  evaluatedRunningRevision: number;
  evidence: Evidence;
};
