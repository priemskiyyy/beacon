// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that a consumer cannot read a fact that a state does not have.
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { CommandOutcome } from "src/types/CommandOutcome";
import type { Observation } from "src/types/Observation";
import type { OperationState } from "src/types/OperationState";
import type { PreparedState } from "src/types/PreparedState";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningApplication } from "src/types/RunningApplication";
import type { ScopeReplacement } from "src/types/ScopeReplacement";
import type { SupportState } from "src/types/SupportState";

declare const running: RunningApplication;

declare const observation: Observation<"web", RouteBody>;

declare const prepared: PreparedState<"web", RouteBody>;

declare const operation: OperationState;

declare const check: CheckOutcome;

declare const outcome: CommandOutcome<{ kind: "reload-requested" }>;

declare const replacement: ScopeReplacement;

declare const support: SupportState;

// A missing fact is pending or unknown, never an old version: only a known one has a release.
// @ts-expect-error A running fact that is not known has no release to read.
export const release = running.web.release;

export const readKnown = () => {
  if (running.web.state !== "known") {
    return null;
  }

  return running.web.release;
};

// Unknown is an answer with no evidence behind it, and only an available observation has an offer.
// @ts-expect-error An observation that is unknown has no evidence.
export const evidence = observation.evidence;

// @ts-expect-error An observation that is not available has no offer.
export const offer = observation.offer;

// Nothing is ready until the provider says so.
// @ts-expect-error A prepared state that is not ready has no target.
export const target = prepared.value;

// An operation that is not running has no id to wait on.
// @ts-expect-error An idle operation has no operation id.
export const id = operation.operation;

// Only a failed check has an error, and only an accepted command has a receipt: an accepted command is a request.
// @ts-expect-error A check that did not fail has no error.
export const error = check.error;

// @ts-expect-error A command that was not accepted has no receipt.
export const receipt = outcome.receipt;

// @ts-expect-error No outcome says an installation happened.
export const installed = outcome.installed;

// @ts-expect-error A replacement that is not blocked names no route.
export const route = replacement.route;

// A read that failed says why, and the last valid evaluation, when there is one, stays beside it.
export const readFailure = () => {
  if (support.reason !== "read-failed") {
    return null;
  }

  return { code: support.error.code, evaluation: support.evaluation };
};

export const unchecked = () => {
  if (support.reason !== "not-checked") {
    return null;
  }

  // @ts-expect-error No check has run, so there is no error to read: a failed read is `read-failed`.
  return support.error.code;
};
