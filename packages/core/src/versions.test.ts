import { expect, test } from "vitest";

import * as versions from "src/versions";

test("the versions entry exports exactly its strategies", () => {
  expect(Object.keys(versions).sort()).toEqual(["custom", "integer", "semver"]);
});
