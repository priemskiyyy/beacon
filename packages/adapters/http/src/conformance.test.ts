import { testReleaseSource } from "@priemskiyyy/beacon/testing";

import { fakeBackend } from "src/fakeBackend.fixture";
import { http } from "src/http";

testReleaseSource({
  name: "http",
  create: () => {
    const backend = fakeBackend();

    return { source: http({ request: backend.request }), reads: backend.reads };
  },
});
