import {
  testReleaseDriver,
  testRunningReader,
} from "@priemskiyyy/beacon/testing";

import { expoBundle } from "src/expoBundle";
import { expoUpdates } from "src/expoUpdates";
import { EMBEDDED, fakeUpdates, UPDATE_A } from "src/fakeUpdates.fixture";
import { createFakeUpdates } from "src/mock/createFakeUpdates";

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
