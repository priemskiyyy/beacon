import { expect, test } from "vitest";

import * as api from "src/index";
import * as react from "src/react";

test("every entry exports exactly its public runtime names", () => {
  expect(Object.keys(api)).toEqual(["BeaconDevtools"]);
  expect(Object.keys(react)).toEqual(["BeaconDevtools"]);
});
