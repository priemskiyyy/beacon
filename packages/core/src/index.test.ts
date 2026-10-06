import { expect, test } from "vitest";

import * as api from "src/index";

test("the package root exports exactly its supported runtime names", () => {
  expect(Object.keys(api).sort()).toEqual([
    "Beacon",
    "BeaconError",
    "compareIdentities",
    "createBootId",
    "keyValueJournalStorage",
    "minimumBuild",
    "newerRoute",
    "supportPolicy",
    "targetRoute",
  ]);
});
