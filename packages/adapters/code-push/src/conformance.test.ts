import { testReleaseDriver } from "@priemskiyyy/beacon/testing";

import { codePushUpdates } from "src/codePushUpdates";
import { fakeCodePush } from "src/fakeCodePush.fixture";

testReleaseDriver({
  name: "code-push",
  create: () => ({
    route: codePushUpdates({ codePush: fakeCodePush().codePush }),
  }),
});
