import { testUpdateMechanism } from "@priemskiyyy/beacon/testing";

import { browserReload } from "src/browserReload";
import { fakeWindow } from "src/fakeWindow.fixture";

testUpdateMechanism({
  name: "browser-reload",
  create: () => {
    const opened = { count: 0 };
    const mechanism = browserReload({ target: fakeWindow() });

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
