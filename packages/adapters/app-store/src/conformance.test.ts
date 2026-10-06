import {
  testReleaseSource,
  testUpdateMechanism,
  testVersionStrategy,
} from "@priemskiyyy/beacon/testing";

import { appleVersion } from "src/appleVersion";
import { appStoreHandoff } from "src/appStoreHandoff";
import { appStoreLookup } from "src/appStoreLookup";
import { APP_ID, fakeLinking, fakeStore } from "src/fakeStore.fixture";

testReleaseSource({
  name: "app-store-lookup",
  create: () => {
    const store = fakeStore();

    return {
      source: appStoreLookup({
        appId: APP_ID,
        country: "de",
        request: store.request,
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
  create: () => {
    const opened = { count: 0 };

    const mechanism = appStoreHandoff({
      appId: APP_ID,
      linking: fakeLinking().linking,
    });

    return {
      mechanism: {
        ...mechanism,
        open: () => {
          opened.count += 1;

          return mechanism.open();
        },
      },
      opens: () => opened.count,
    };
  },
});
