import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { SupportEvaluation } from "src/types/SupportEvaluation";
import type { SupportStatus } from "src/types/SupportStatus";

/**
 * Everything published about support, in dimensions that never rewrite each
 * other. `status` is what is in force: the last evaluation's, unless its
 * policy lapsed, which makes it unknown and keeps that evaluation beside it.
 * A policy that fails to evaluate leaves the last valid evaluation in force and
 * reports the failure in `error`; with none to keep, support is unknown for
 * `evaluation-failed`. A read of the policy's source that fails while nothing
 * is in force, because none was accepted or the accepted one lapsed, is
 * unknown for `read-failed` with the failure in `error`, and the last valid
 * evaluation, if there is one, stays beside it as for `expired`; a read that
 * fails while an evaluation still holds changes nothing until it lapses.
 * `not-checked` means only that no check has run. A failing check, or a
 * failing evaluation, never turns `supported` into `unsupported`, and a
 * dismissal never changes it at all.
 *
 * `reason` says why `status` is unknown when Beacon reached that itself, and
 * is `null` when an evaluation is in force. Which of `evaluation` and `error`
 * are there follows from it, so a state narrowed by `reason` needs no null
 * check for what it must have.
 *
 * @example
 * ```ts
 * const support = beacon.support.get();
 *
 * if (support.reason === null && support.status === "unsupported") {
 *   console.info(support.evaluation.reasons.map((reason) => reason.code));
 * }
 *
 * if (support.reason === "read-failed") {
 *   console.warn(support.error.code, support.error.message);
 * }
 * ```
 */
export type SupportState = { revision: number } & (
  | {
      status: "unknown";
      reason: "no-policy" | "not-checked";
      evaluation: null;
      error: null;
    }
  | {
      status: "unknown";
      reason: "evaluation-failed";
      evaluation: null;
      error: BeaconErrorInfo;
    }
  | {
      status: "unknown";
      reason: "read-failed";
      evaluation: SupportEvaluation | null;
      error: BeaconErrorInfo;
    }
  | {
      status: "unknown";
      reason: "expired";
      evaluation: SupportEvaluation;
      error: BeaconErrorInfo | null;
    }
  | {
      status: SupportStatus;
      reason: null;
      evaluation: SupportEvaluation;
      error: BeaconErrorInfo | null;
    }
);
