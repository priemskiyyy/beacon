import {
  testReleaseSource,
  testUpdateMechanism,
  testVersionStrategy,
} from "@priemskiyyy/beacon/testing";

import { appleVersion } from "src/appleVersion";
import { appStoreHandoff } from "src/appStoreHandoff";
import { appStoreLookup } from "src/appStoreLookup";
import {
  APP_ID,
  BUNDLE_ID,
  fakeLinking,
  fakeStore,
} from "src/fakeStore.fixture";

testReleaseSource({
  name: "app-store-lookup",
  scope: {
    application: BUNDLE_ID,
    environment: "production",
    platform: "ios",
    distribution: "app-store",
  },
  create: () => {
    const store = fakeStore();

    return {
      source: appStoreLookup({
        appId: APP_ID,
        country: "de",
        fetch: store.fetch,
      }),
      reads: store.reads,
    };
  },
});

testVersionStrategy({
  name: "apple-marketing-version",
  create: () => appleVersion(),
  ascending: ["1", "1.2", "1.10", "2.0.1", "10"],
  invalid: ["", "3.2.1.0", "latest", "3.x"],
});

testUpdateMechanism({
  name: "app-store-handoff",
  create: () => ({
    mechanism: appStoreHandoff({
      appId: APP_ID,
      linking: fakeLinking().linking,
    }),
  }),
});
