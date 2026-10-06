import { expect, test } from "vitest";

import {
  available,
  notAvailable,
  rollbackCheck,
  UPDATE_A,
} from "src/fakeUpdates.fixture";
import { readCheckResult } from "src/utils/readCheckResult";

test("EXPO-01 an available update is an offer named by the id its server assigned", () => {
  expect(readCheckResult(available(UPDATE_A))).toEqual({
    status: "available",
    offer: {
      release: {
        identity: {
          status: "known",
          authority: "expo-updates",
          domain: "update",
          value: UPDATE_A,
        },
      },
      kind: "update",
    },
  });
});

test("EXPO-02 a rollback to the embedded update is an offer of its own, with an identity nobody named", () => {
  expect(readCheckResult(rollbackCheck())).toEqual({
    status: "available",
    offer: {
      release: { identity: { status: "unknown", reason: "embedded-rollback" } },
      kind: "rollback-to-embedded",
    },
  });
});

test("EXPO-03 a valid answer with neither is no offer, and keeps the SDK's own reason", () => {
  expect(
    readCheckResult(notAvailable("updateRejectedBySelectionPolicy")),
  ).toEqual({
    status: "none",
    reason: "no-decision",
    detail: "updateRejectedBySelectionPolicy",
  });
});
