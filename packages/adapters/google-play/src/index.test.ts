import { expect, test } from "vitest";

import * as api from "src/index";

test("the package root exports exactly its supported runtime names", () => {
  expect(Object.keys(api).sort()).toEqual([
    "GOOGLE_PLAY_DISTRIBUTION",
    "googlePlay",
    "playStore",
  ]);
});
