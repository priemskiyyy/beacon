import { testReleaseSource } from "@priemskiyyy/beacon/testing";

import { fakeBackend, SCOPE } from "src/fakeBackend.fixture";
import { fakeStaticServer } from "src/fakeStaticServer.fixture";
import { http } from "src/http";
import { standardManifestSource } from "src/standardManifestSource";

testReleaseSource({
  name: "http",
  create: () => {
    const backend = fakeBackend();

    return { source: http({ fetch: backend.fetch }), reads: backend.reads };
  },
});

// The manifest source holds the same contract over a server that answers with an etag and a manifest of a static host.
testReleaseSource({
  name: "standardManifestSource",
  scope: SCOPE,
  create: () => {
    const server = fakeStaticServer();

    return {
      source: standardManifestSource({
        url: "/releases.json",
        routes: { web: { kind: "target" } },
        fetch: server.fetch,
      }),
      reads: server.reads,
    };
  },
});
