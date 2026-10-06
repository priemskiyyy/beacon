import { expect, test } from "vitest";

import * as mock from "src/mock";

test("the mock entry exports exactly its helpers", () => {
  expect(Object.keys(mock).sort()).toEqual([
    "createMockSource",
    "createTestClock",
  ]);
});
