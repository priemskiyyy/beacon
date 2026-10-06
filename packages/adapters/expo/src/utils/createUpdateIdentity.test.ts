import { compareIdentities } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { expoBundle } from "src/expoBundle";
import {
  fakeUpdates,
  SCOPE,
  UPDATE_A,
  UPDATE_B,
} from "src/fakeUpdates.fixture";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";

test("EXPO-01 an id a server wrote in capitals is the update the SDK reports running in lowercase", async () => {
  const { updates } = fakeUpdates({ updateId: UPDATE_A });
  const offered = createUpdateIdentity(UPDATE_A.toUpperCase());

  const running = await expoBundle({ updates })({ scope: SCOPE });

  expect(compareIdentities(offered, running.identity)).toBe("same");
  expect(compareIdentities(offered, createUpdateIdentity(UPDATE_B))).toBe(
    "different",
  );
});
