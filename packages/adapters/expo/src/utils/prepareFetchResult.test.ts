import { expect, test } from "vitest";

import {
  fetchedNew,
  fetchedNothing,
  fetchedRollback,
  UPDATE_A,
  UPDATE_B,
} from "src/fakeUpdates.fixture";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";
import { prepareFetchResult } from "src/utils/prepareFetchResult";

const offeredA = createUpdateIdentity(UPDATE_A);

test("EXPO-05 a new update is prepared, and says it is the one that was offered", () => {
  expect(prepareFetchResult(fetchedNew(UPDATE_A), offeredA)).toEqual({
    prepared: {
      status: "ready",
      value: { release: { identity: offeredA }, kind: "update" },
    },
    receipt: {
      kind: "update-prepared",
      update: { id: UPDATE_A },
      offered: "same",
    },
  });
});

test("EXPO-08 a different update than the one offered is prepared, and says it differs", () => {
  const { receipt } = prepareFetchResult(fetchedNew(UPDATE_B), offeredA);

  expect(receipt).toEqual({
    kind: "update-prepared",
    update: { id: UPDATE_B },
    offered: "different",
  });
});

test("EXPO-07 a valid answer that is not new prepares nothing and claims nothing prepared", () => {
  expect(prepareFetchResult(fetchedNothing(), offeredA)).toEqual({
    prepared: null,
    receipt: { kind: "no-new-preparation" },
  });
});

test("EXPO-06 a rollback is prepared without a manifest, and cannot be compared with an offer", () => {
  const { prepared, receipt } = prepareFetchResult(fetchedRollback(), offeredA);

  expect(prepared).toMatchObject({
    status: "ready",
    value: { kind: "rollback-to-embedded" },
  });
  expect(receipt).toEqual({ kind: "rollback-prepared", offered: "unknown" });
});
