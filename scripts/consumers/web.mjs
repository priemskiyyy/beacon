// A Vite and React 19 web application over the packed packages: the browser setup
// of the documentation's getting-started page, with relative imports so that one
// source tree compiles under `bundler`, `node16` and `nodenext` resolution.
export const WEB_PACKAGES = [
  "@priemskiyyy/beacon",
  "@priemskiyyy/beacon-react",
  "@priemskiyyy/beacon-http",
  "@priemskiyyy/beacon-browser",
  "@priemskiyyy/beacon-service-worker",
  "@priemskiyyy/beacon-app-store",
  "@priemskiyyy/beacon-google-play",
  "@priemskiyyy/beacon-devtools",
];

export const webFiles = {
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Beacon consumer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

  "vite.config.ts": `import { defineConfig } from "vite";

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify("build-a"), __DEV__: "false" },
  build: { outDir: "dist", sourcemap: true },
});
`,

  "src/beacon.ts": `import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

declare const __BUILD_ID__: string;

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

const routes = { web: { kind: "target" } } satisfies RouteDeclarations;

const manifest = http({
  fetch: async ({ scope, signal, validator }) =>
    readStandardManifest({
      response: await fetch("/releases.json", {
        signal,
        headers: validator === null ? {} : { "if-none-match": validator },
      }),
      scope,
      routes,
      now: Date.now(),
    }),
});

export const beacon = new Beacon({
  scope,
  running: { web: webBuild({ id: __BUILD_ID__ }) },
  routes: {
    web: targetRoute({
      source: manifest.select((document) => document.routes.web),
      mechanism: browserReload(),
    }),
  },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
`,

  "src/main.tsx": `import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { beacon } from "./beacon.js";
import { Inspector } from "./Inspector.js";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element.");
}

createRoot(container).render(
  <BeaconProvider beacon={beacon}>
    <App />
    <Inspector />
  </BeaconProvider>,
);
`,

  "src/Inspector.tsx": `import { BeaconDevtools } from "@priemskiyyy/beacon-devtools/react";

declare const __DEV__: boolean;

// The inspector is for development, so a production build keeps none of it.
export const Inspector = () => {
  if (!__DEV__) {
    return null;
  }

  return <BeaconDevtools />;
};
`,

  "src/App.tsx": `import { useBeacon } from "@priemskiyyy/beacon-react";
import { checkOn } from "@priemskiyyy/beacon/triggers";
import { foreground, reconnect } from "@priemskiyyy/beacon/triggers/browser";
import { useEffect } from "react";

import { UpdateBanner } from "./UpdateBanner.js";

export const App = () => {
  const beacon = useBeacon();

  useEffect(
    () => checkOn(beacon, { triggers: [foreground(), reconnect()] }),
    [beacon],
  );

  return (
    <main>
      <UpdateBanner />
    </main>
  );
};
`,

  "src/UpdateBanner.tsx": `import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const observation = useRoute("web", (snapshot) => snapshot.observation);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const outcome = await beacon
      .route("web")
      .reload({ offer: observation.offer });

    if (outcome.status !== "accepted") {
      console.warn("The update did not start:", outcome.status);
    }
  };

  return (
    <button onClick={update}>
      Update to {observation.offer.release.label ?? "the new version"}
    </button>
  );
};
`,

  // What the compiler must refuse, proved from the packed declarations alone.
  "src/contracts.tsx": `import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { createReleaseSource } from "@priemskiyyy/beacon/adapter";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
import { semver } from "@priemskiyyy/beacon/versions";

export const View = () => {
  const beacon = useBeacon();
  const known = useRoute("web", (snapshot) => snapshot.observation.status);

  // @ts-expect-error -- "nope" is not a route of the registered Beacon.
  useRoute("nope");
  // @ts-expect-error -- a route is looked up by a name it has.
  beacon.route("nope");
  // @ts-expect-error -- the browser reload names the offer it was asked about.
  beacon.route("web").reload({});

  return <span>{known}</span>;
};

export const toolbox = [
  createReleaseSource,
  createMockSource,
  createTestClock,
  semver,
];
`,
};

// Plain Node ESM, no bundler: the whole path from a manifest to a requested reload, through the packed packages.
export const webSmoke = `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";
import { standardManifestSource } from "@priemskiyyy/beacon-http";
import { BeaconProvider } from "@priemskiyyy/beacon-react";

const reloads = { count: 0 };

const manifest = standardManifestSource({
  url: "https://example.test/releases.json",
  routes: { web: { kind: "target" } },
  fetch: async () =>
    new Response(
      JSON.stringify({
        schemaVersion: 1,
        routes: { web: { kind: "target", release: { identity: "build-b" } } },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
});

const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { web: webBuild({ id: "build-a" }) },
  routes: {
    web: targetRoute({
      source: manifest.select((document) => document.routes.web),
      mechanism: browserReload({
        target: { location: { reload: () => { reloads.count += 1; } } },
      }),
    }),
  },
  clock: createTestClock({ now: Date.now() }),
});

// Rendering on a server opens nothing: the provider's session starts in an effect.
assert.equal(renderToString(createElement(BeaconProvider, { beacon }, "ready")), "ready");
assert.equal(beacon.status.get().state, "idle");

beacon.start();
await beacon.check({ reason: "manual" });

const { observation } = beacon.route("web").state.get();

assert.equal(observation.status, "available");

const outcome = await beacon.route("web").reload({ offer: observation.offer });

assert.equal(outcome.status, "accepted");
assert.equal(reloads.count, 1);
beacon.dispose();

// A CommonJS program on Node 22.12 or later can require an ES module that has no top-level await.
const require = createRequire(import.meta.url);

assert.equal(typeof require("@priemskiyyy/beacon").Beacon, "function");
console.log("The packed web packages work end to end under Node.");
`;

// The same app without the inspector, for the oldest React the binding claims.
export const react18Files = Object.fromEntries(
  Object.entries(webFiles)
    .filter(([name]) => name !== "src/Inspector.tsx")
    .map(([name, content]) => {
      if (name !== "src/main.tsx") {
        return [name, content];
      }

      return [
        name,
        content
          .replace('import { Inspector } from "./Inspector.js";\n', "")
          .replace("    <Inspector />\n", ""),
      ];
    }),
);
