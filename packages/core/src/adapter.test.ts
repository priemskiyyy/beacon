import { expect, test } from "vitest";

import * as adapter from "src/adapter";
import * as api from "src/index";

test("the adapter entry exports exactly the names of an author", () => {
  expect(Object.keys(adapter).sort()).toEqual([
    "ANDROID_VERSION_CODE_DOMAIN",
    "IOS_BUILD_DOMAIN",
    "WEB_ARTIFACT_DOMAIN",
    "createReleaseDriver",
    "createReleaseSource",
    "createUpdateMechanism",
    "parseUtcTimestamp",
  ]);
});

test("no name is exported by both the root and the adapter entry", () => {
  const shared = Object.keys(adapter).filter((name) => name in api);

  expect(shared).toEqual([]);
});
