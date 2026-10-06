import { expect, test } from "vitest";

import * as api from "src/triggers";

test("the triggers entry exports exactly its supported runtime names", () => {
  expect(Object.keys(api).sort()).toEqual([
    "checkOn",
    "foreground",
    "interval",
    "invalidation",
    "pulseForeground",
    "reachReconnect",
    "reconnect",
  ]);
});
