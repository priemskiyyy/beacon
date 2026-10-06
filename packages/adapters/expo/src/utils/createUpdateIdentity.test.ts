import { compareIdentities } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { expoBundle } from "src/expoBundle";
import { fakeUpdates, UPDATE_A, UPDATE_B } from "src/fakeUpdates.fixture";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";

test("EXPO-01 an id a server wrote in capitals is the update the SDK reports running in lowercase", () => {
  const { updates } = fakeUpdates({ updateId: UPDATE_A });
  const offered = createUpdateIdentity(UPDATE_A.toUpperCase());

  expect(compareIdentities(offered, expoBundle(updates)().identity)).toBe(
    "same",
  );
  expect(compareIdentities(offered, createUpdateIdentity(UPDATE_B))).toBe(
    "different",
  );
});
