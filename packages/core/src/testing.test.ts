import { expect, test } from "vitest";

import * as testing from "src/testing";

test("the testing entry exports exactly its conformance suites", () => {
  expect(Object.keys(testing).sort()).toEqual([
    "testReleaseDriver",
    "testReleaseSource",
    "testUpdateMechanism",
    "testVersionStrategy",
  ]);
});
