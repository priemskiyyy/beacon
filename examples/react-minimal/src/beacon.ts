import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import {
  browserReload,
  browserStorage,
  webBuild,
} from "@priemskiyyy/beacon-browser";
import { standardManifestSource } from "@priemskiyyy/beacon-http";

const releases = standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
});

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { web: webBuild({ id: import.meta.env.VITE_BUILD_ID }) },
  routes: {
    web: targetRoute({
      source: releases.select((manifest) => manifest.routes.web),
      mechanism: browserReload(),
    }),
  },
  journal: { storage: browserStorage() },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
