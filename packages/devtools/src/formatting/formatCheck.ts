import type { CheckState } from "@priemskiyyy/beacon";

import { assertUnreachable } from "src/utils/assertUnreachable";

/** The latest check of a route in a few words, with the error code when it failed. */
export const formatCheck = (check: CheckState) => {
  if (check.state === "idle") {
    return "idle";
  }

  if (check.state === "checking") {
    return `checking, attempt ${check.attempt}`;
  }

  if (check.state === "succeeded") {
    return "succeeded";
  }

  if (check.state === "failed") {
    return `failed, ${check.error.code}`;
  }

  return assertUnreachable(check);
};
