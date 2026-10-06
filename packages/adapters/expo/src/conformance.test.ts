import type { ReleaseScope } from "@priemskiyyy/beacon";
import {
  testReleaseDriver,
  testRunningReader,
} from "@priemskiyyy/beacon/testing";

import { expoApplication } from "src/expoApplication";
import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import {
  fakeApplication,
  SCOPE as ANDROID_SCOPE,
} from "src/fakeApplication.fixture";
import { EMBEDDED, fakeUpdates, UPDATE_A } from "src/fakeUpdates.fixture";
import { createFakeUpdates } from "src/mock/createFakeUpdates";
import type { NativePlatform } from "src/types/NativePlatform";

testReleaseDriver({
  name: "expo-updates",
  create: () => ({ route: expoUpdates({ updates: fakeUpdates().updates }) }),
});

testReleaseDriver({
  name: "expo-updates with updates disabled",
  create: () => ({
    route: expoUpdates({
      updates: fakeUpdates({ isEnabled: false, updateId: null }).updates,
    }),
  }),
});

testReleaseDriver({
  name: "expo-updates over the fake of the mock entry",
  create: () => ({
    route: expoUpdates({ updates: createFakeUpdates({ available: true }) }),
  }),
});

const createHost = (options: Parameters<typeof fakeUpdates>[0]) => {
  const host = { asked: 0 };
  const { updates } = fakeUpdates(options);

  // Every member the reader touches is counted as an ask.
  const counted = new Proxy(updates, {
    get: (target, key, receiver) => {
      host.asked += 1;

      return Reflect.get(target, key, receiver);
    },
  });

  return { reader: expoBundle({ updates: counted }), reads: () => host.asked };
};

testRunningReader({
  name: "expo bundle",
  create: () => createHost({ updateId: UPDATE_A, isEmbeddedLaunch: false }),
  situations: [
    {
      name: "the embedded update runs after an emergency launch",
      answers: "known",
      create: () =>
        createHost({
          updateId: EMBEDDED,
          isEmbeddedLaunch: true,
          isEmergencyLaunch: true,
        }),
    },
    {
      name: "updates are disabled",
      answers: "unknown",
      create: () => createHost({ isEnabled: false, updateId: null }),
    },
  ],
});

const PLATFORMS: NativePlatform[] = ["android", "ios"];

for (const platform of PLATFORMS) {
  const scope: ReleaseScope = { ...ANDROID_SCOPE, platform };

  const createApplication = (
    facts: Parameters<typeof fakeApplication>[0] = {},
  ) => {
    const { application, reads } = fakeApplication(facts);

    return { reader: expoApplication({ application }), reads };
  };

  testRunningReader({
    name: `expo-application on ${platform}`,
    create: () => createApplication(),
    scope,
    situations: [
      {
        name: "the scope is a web application's",
        answers: "unknown",
        scope: { ...scope, platform: "web" },
        create: () => createApplication(),
      },
      {
        name: "the module gave no build number",
        answers: "unknown",
        create: () => createApplication({ build: null }),
      },
      {
        name: "the module gave no application id",
        answers: "unknown",
        create: () => createApplication({ applicationId: null }),
      },
      {
        name: "the binary is another application",
        answers: "unknown",
        create: () => createApplication({ applicationId: "host.exp.Exponent" }),
      },
      {
        name: "the module gave no marketing version",
        answers: "known",
        create: () => createApplication({ version: null }),
      },
    ],
  });
}
