import { expect, test } from "vitest";

import {
  fetchedNew,
  fetchedNothing,
  fetchedRollback,
  UPDATE_A,
  UPDATE_B,
} from "src/fakeUpdates.fixture";
import { ROLLBACK_IDENTITY } from "src/utils/constants/identities";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";
import { readFetchResult } from "src/utils/readFetchResult";

const offeredA = createUpdateIdentity(UPDATE_A);

test("EXPO-05 a new update is prepared, and says it is the one that was offered", () => {
  expect(readFetchResult(fetchedNew(UPDATE_A), offeredA)).toEqual({
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
  const { receipt } = readFetchResult(fetchedNew(UPDATE_B), offeredA);

  expect(receipt).toEqual({
    kind: "update-prepared",
    update: { id: UPDATE_B },
    offered: "different",
  });
});

test("EXPO-07 a valid answer that is not new prepares nothing and claims nothing prepared", () => {
  expect(readFetchResult(fetchedNothing(), offeredA)).toEqual({
    prepared: null,
    receipt: { kind: "no-new-preparation" },
  });
});

test("EXPO-06 a rollback is prepared without a manifest, and cannot be compared with an offer", () => {
  const { prepared, receipt } = readFetchResult(fetchedRollback(), offeredA);

  expect(prepared).toMatchObject({
    status: "ready",
    value: { kind: "rollback-to-embedded" },
  });
  expect(receipt).toEqual({ kind: "rollback-prepared", offered: "unknown" });
});

test("EXPO-08 an update fetched for a rollback offer is prepared, and cannot be compared with an offer that names nothing", () => {
  const { receipt } = readFetchResult(fetchedNew(UPDATE_A), ROLLBACK_IDENTITY);

  expect(receipt).toEqual({
    kind: "update-prepared",
    update: { id: UPDATE_A },
    offered: "unknown",
  });
});
