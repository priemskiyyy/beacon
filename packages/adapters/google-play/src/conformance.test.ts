import { testReleaseDriver } from "@priemskiyyy/beacon/testing";

import {
  availableInfo,
  fakeBridge,
  installEvent,
} from "src/fakeBridge.fixture";
import { googlePlay } from "src/googlePlay";

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
