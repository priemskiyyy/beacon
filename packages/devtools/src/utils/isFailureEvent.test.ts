import { expect, test } from "vitest";

import { isFailureEvent } from "src/utils/isFailureEvent";

test("exactly the failure types are failures", () => {
  for (const type of [
    "route-failed",
    "policy-failed",
    "journal-failed",
    "running-failed",
    "read-failed",
    "listener-error",
    "cleanup-error",
    "late-callback",
  ]) {
    expect(isFailureEvent(type), type).toBe(true);
  }

  for (const type of [
    "session-started",
    "check-requested",
    "read-abandoned",
    "command-settled",
    "journal-ignored",
    "unknown-event",
    "",
    "toString",
  ]) {
    expect(isFailureEvent(type), type).toBe(false);
  }
});
