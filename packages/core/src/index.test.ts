import { expect, test } from "vitest";

import * as api from "src/index";

test("the package root exports exactly its supported runtime names", () => {
  expect(Object.keys(api).sort()).toEqual([
    "ANDROID_VERSION_CODE_DOMAIN",
    "Beacon",
    "BeaconError",
    "IOS_BUILD_DOMAIN",
    "WEB_ARTIFACT_DOMAIN",
    "compareIdentities",
    "createBootId",
    "createReleaseDriver",
    "createReleaseSource",
    "createUpdateMechanism",
    "keyValueJournalStorage",
    "minimumBuild",
    "newerRoute",
    "parseUtcTimestamp",
    "supportPolicy",
    "targetRoute",
  ]);
});
