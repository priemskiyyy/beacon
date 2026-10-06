import type { CheckState } from "@priemskiyyy/beacon";
import { match } from "ts-pattern";

import { formatClockTime } from "example-shared/formatting/formatClockTime";

export const formatCheck = (check: CheckState) =>
  match(check)
    .with({ state: "idle" }, () => "No check yet")
    .with(
      { state: "checking" },
      ({ attempt }) => `Checking, attempt ${attempt}`,
    )
    .with(
      { state: "succeeded" },
      ({ settledAt }) => `Succeeded at ${formatClockTime(settledAt)}`,
    )
    .with(
      { state: "failed" },
      ({ settledAt, error }) =>
        `Failed at ${formatClockTime(settledAt)}: ${error.code}`,
    )
    .exhaustive();
