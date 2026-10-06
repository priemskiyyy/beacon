import { testReleaseDriver } from "@priemskiyyy/beacon/testing";

import {
  countListeners,
  fakeContainer,
  fakeRegistration,
  fakeWorker,
} from "src/fakeWorkers.fixture";
import { serviceWorker } from "src/serviceWorker";

testReleaseDriver({
  name: "service-worker",
  create: () => {
    const registration = fakeRegistration({
      active: fakeWorker("activated"),
      waiting: fakeWorker(),
    });

    const container = fakeContainer(() => registration);

    return {
      route: serviceWorker({ container }),
      provider: {
        update: () => registration.found(fakeWorker()),
        listeners: () => countListeners(registration, container),
      },
    };
  },
});

testReleaseDriver({
  name: "service-worker without a container",
  create: () => ({ route: serviceWorker() }),
});
