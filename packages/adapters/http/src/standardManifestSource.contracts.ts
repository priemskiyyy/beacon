// Typechecked, never run: a manifest source reads the routes the application
// declared, and the client it is given is anything that takes a URL and the
// options of one request.
import { createUpdateMechanism, targetRoute } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { standardManifestSource } from "src/standardManifestSource";
import type { ManifestFetch } from "src/types/ManifestFetch";
import type { StandardManifest } from "src/types/StandardManifest";

// The global fetch of a browser and of Node is a client as it stands, and so is one that wraps it.
expectTypeOf(fetch).toExtend<ManifestFetch>();

const inert = createUpdateMechanism({
  name: "inert",
  open: () => ({ native: {} }),
  commands: {},
});

export const manifest = standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
});

expectTypeOf(manifest).toEqualTypeOf<
  ReleaseSource<StandardManifest<{ web: { kind: "target" } }>>
>();

export const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.routes.web),
  mechanism: inert,
});

// @ts-expect-error -- a route the application did not declare is not in the document.
manifest.select((document) => document.routes.elsewhere);

// @ts-expect-error -- the URL is what the source reads, so it is required.
standardManifestSource({ routes: { web: { kind: "target" } } });

// @ts-expect-error -- the routes are what the application reads from the manifest, so they are required.
standardManifestSource({ url: "/releases.json" });

standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
  // @ts-expect-error -- a client answers a response with a status and a body, not the text of one.
  fetch: async () => "{}",
});

standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
  // @ts-expect-error -- a header is text.
  headers: { "x-retries": 3 },
});

// A client of your own may ignore the options it does not need, and a limit is tuned alone.
export const own = standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
  fetch: async (url) => fetch(url),
  limits: { lifetime: 600_000 },
});
