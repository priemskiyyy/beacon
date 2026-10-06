import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { SupportEvaluation } from "src/types/SupportEvaluation";
import type { SupportStatus } from "src/types/SupportStatus";
import type { SupportUnknownReason } from "src/types/SupportUnknownReason";

/**
 * Everything published about support, in dimensions that never rewrite each
 * other. `status` is what is in force: the last evaluation's, unless its
 * policy lapsed, which makes it unknown and keeps that evaluation beside it.
 * A policy that fails to evaluate leaves the last valid evaluation in force and
 * reports the failure in `error`; with none to keep, support is unknown for
 * `evaluation-failed`. A failing check, or a failing evaluation, never turns
 * `supported` into `unsupported`, and a dismissal never changes it at all.
 *
 * @example
 * ```ts
 * const { status, evaluation } = beacon.support.get();
 *
 * if (status === "unsupported" && evaluation !== null) {
 *   console.info(evaluation.reasons.map((reason) => reason.code));
 * }
 * ```
 */
export type SupportState = {
  /** Grows with every meaningful change of this snapshot. */
  revision: number;
  status: SupportStatus;
  /** Why `status` is unknown when Beacon reached that itself, else `null`. */
  reason: SupportUnknownReason | null;
  /** The last evaluation, in force unless `reason` says it is not. */
  evaluation: SupportEvaluation | null;
  /** The policy-stage failure of the latest evaluation, kept beside the last valid one. */
  error: BeaconErrorInfo | null;
};
