import { testReleaseDriver } from "@priemskiyyy/beacon/testing";

import {
  availableInfo,
  fakeBridge,
  installEvent,
} from "src/fakeBridge.fixture";
import { fakeLinking } from "src/fakeLinking.fixture";
import { googlePlay } from "src/googlePlay";
import { playStore } from "src/playStore";

testReleaseDriver({
  name: "google-play",
  create: () => {
    const fake = fakeBridge(availableInfo(412));

    return {
      route: googlePlay({ bridge: fake.bridge }),
      provider: {
        update: () => fake.install(installEvent("downloaded")),
        listeners: fake.listeners,
      },
    };
  },
});

testReleaseDriver({
  name: "play-store",
  create: () => ({
    route: playStore({
      applicationId: "com.example.notes",
      linking: fakeLinking().linking,
    }),
  }),
});
