import { testReleaseDriver } from "@priemskiyyy/beacon/testing";

import { expoUpdates } from "src/expoUpdates";
import { fakeUpdates } from "src/fakeUpdates.fixture";

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
