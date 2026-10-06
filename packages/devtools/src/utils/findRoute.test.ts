import { expect, test } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import { findRoute } from "src/utils/findRoute";
import { withRoutes } from "src/withRoutes.fixture";

test("a route is found by its name, and a name the Beacon cannot give is null instead of an error", () => {
  const { beacon } = createLabBeacon();

  expect(findRoute(beacon, "web")?.state.get().check).toEqual({
    state: "idle",
  });
  expect(findRoute(beacon, "elsewhere")).toBeNull();
  expect(
    findRoute(
      withRoutes(beacon, [], () => {
        throw new Error("no such route");
      }),
      "web",
    ),
  ).toBeNull();
});
