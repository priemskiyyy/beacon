import { testUpdateMechanism } from "@priemskiyyy/beacon/testing";

import { browserReload } from "src/browserReload";
import { fakeWindow } from "src/fakeWindow.fixture";

testUpdateMechanism({
  name: "browser-reload",
  create: () => ({ mechanism: browserReload({ target: fakeWindow() }) }),
});
