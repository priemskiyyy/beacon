import type { CheckOutcome } from "src/types/CheckOutcome";
import type { CheckFailure } from "src/types/internal/CheckFailure";
import type { ReadResult } from "src/types/internal/ReadResult";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";

/**
 * How a caller's check settled. An accepted answer can still fail its own
 * selection or evaluation, which only the failure recorded for that attempt
 * knows.
 */
export const toCheckOutcome = (
  result: ReadResult,
  failure: CheckFailure | null,
): CheckOutcome => {
  if (result.status === "cancelled") {
    return { status: "cancelled" };
  }

  if (result.status === "superseded") {
    return { status: "superseded" };
  }

  if (result.status === "failed") {
    return {
      status: "failed",
      attempt: result.attempt,
      error: toErrorInfo(result.error),
    };
  }

  if (result.status === "accepted") {
    if (failure === null || failure.attempt !== result.attempt) {
      return { status: "succeeded", attempt: result.attempt };
    }

    return {
      status: "failed",
      attempt: result.attempt,
      error: toErrorInfo(failure.error),
    };
  }

  return assertUnreachable(result);
};
