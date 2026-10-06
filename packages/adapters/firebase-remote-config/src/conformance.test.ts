import { createTestClock } from "@priemskiyyy/beacon/mock";
import { testReleaseSource } from "@priemskiyyy/beacon/testing";

import { fakeRemoteConfig, SCOPE, START } from "src/fakeRemoteConfig.fixture";
import { firebaseRemoteConfig } from "src/firebaseRemoteConfig";

testReleaseSource({
  name: "firebase-remote-config",
  scope: SCOPE,
  create: () => {
    const fake = fakeRemoteConfig({ now: createTestClock({ now: START }).now });

    fake.serve({ minimum_build: "120" });

    return {
      source: firebaseRemoteConfig({
        remoteConfig: fake.remoteConfig,
        sdk: fake.sdk,
        document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
      }),
      reads: fake.reads,
    };
  },
});
