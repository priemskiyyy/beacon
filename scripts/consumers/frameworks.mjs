// The secondary bindings, installed with their frameworks: Vue and Solid rendered
// on a server under plain Node, and Svelte, which ships its sources for the
// application's own compiler, built by Vite and checked by svelte-check.
export const FRAMEWORK_PACKAGES = [
  "@priemskiyyy/beacon",
  "@priemskiyyy/beacon-browser",
  "@priemskiyyy/beacon-vue",
  "@priemskiyyy/beacon-solid",
  "@priemskiyyy/beacon-svelte",
];

export const frameworkFiles = {
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Beacon consumer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,

  "vite.config.ts": `import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [svelte()], build: { outDir: "dist" } });
`,

  "svelte.config.js": `import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default { preprocess: vitePreprocess() };
`,

  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["svelte"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
`,

  "tsconfig.node.json": `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": [],
    "noEmit": false,
    "outDir": "dist-node"
  },
  "include": ["src/beacon.ts", "src/vue.ts", "src/solid.ts"]
}
`,

  "src/beacon.ts": `import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";

type Deployment = {
  web: {
    kind: "target";
    release: {
      identity: { status: "known"; authority: string; domain: string; value: string };
      label: string;
    };
  };
};

const mock = createMockSource<Deployment>({ name: "manifest" });

export const createBeacon = () =>
  new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "web",
      distribution: "public-web",
    },
    running: { web: webBuild({ id: "build-a" }) },
    routes: {
      web: targetRoute({
        source: mock.source.select((document) => document.web),
        mechanism: browserReload({ target: { location: { reload: () => {} } } }),
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

export type AppBeacon = ReturnType<typeof createBeacon>;
`,

  "src/vue.ts": `import { BeaconProvider, useBeacon, useRoute } from "@priemskiyyy/beacon-vue";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";

import { createBeacon } from "./beacon.js";
import type { AppBeacon } from "./beacon.js";

declare module "@priemskiyyy/beacon-vue" {
  interface Register {
    beacon: AppBeacon;
  }
}

const Status = defineComponent({
  setup: () => {
    const status = useRoute("web", (snapshot) => snapshot.observation.status);

    return () => h("span", status.value);
  },
});

// Compiled, never called: what the registered Beacon makes a type error.
export const contracts = () => {
  useBeacon().value.route("web");
  // @ts-expect-error -- "nope" is not a route of the registered Beacon.
  useRoute("nope");
};

export const render = () =>
  renderToString(
    createSSRApp({
      render: () => h(BeaconProvider, { beacon: createBeacon() }, () => h(Status)),
    }),
  );
`,

  "src/solid.ts": `import { BeaconProvider, useRoute } from "@priemskiyyy/beacon-solid";
import { createComponent } from "solid-js";
import { renderToString } from "solid-js/web";

import { createBeacon } from "./beacon.js";
import type { AppBeacon } from "./beacon.js";

declare module "@priemskiyyy/beacon-solid" {
  interface Register {
    beacon: AppBeacon;
  }
}

const Status = () => {
  const status = useRoute("web", (snapshot) => snapshot.observation.status);

  return status();
};

// Compiled, never called: what the registered Beacon makes a type error.
export const contracts = () => {
  // @ts-expect-error -- "nope" is not a route of the registered Beacon.
  useRoute("nope");
};

export const render = () =>
  renderToString(() =>
    createComponent(BeaconProvider, {
      beacon: createBeacon(),
      get children() {
        return createComponent(Status, {});
      },
    }),
  );
`,

  "src/svelte.ts": `import type { RegisteredBeacon } from "@priemskiyyy/beacon-svelte";

import type { AppBeacon } from "./beacon.js";

declare module "@priemskiyyy/beacon-svelte" {
  interface Register {
    beacon: AppBeacon;
  }
}

export type Props = { beacon: RegisteredBeacon };
`,

  "src/Status.svelte": `<script lang="ts">
  import { useRoute } from "@priemskiyyy/beacon-svelte";

  const status = useRoute("web", (snapshot) => snapshot.observation.status);

  // Compiled, never called: what the registered Beacon makes a type error.
  export const contracts = () => {
    // @ts-expect-error -- "nope" is not a route of the registered Beacon.
    useRoute("nope");
  };
</script>

<span>{status.current}</span>
`,

  "src/App.svelte": `<script lang="ts">
  import { BeaconProvider } from "@priemskiyyy/beacon-svelte";

  import Status from "./Status.svelte";
  import type { Props } from "./svelte";

  const { beacon }: Props = $props();
</script>

<BeaconProvider {beacon}>
  <Status />
</BeaconProvider>
`,

  "src/main.ts": `import { mount } from "svelte";

import App from "./App.svelte";
import { createBeacon } from "./beacon";

const target = document.getElementById("app");

if (target === null) {
  throw new Error("The page has no #app element.");
}

mount(App, { target, props: { beacon: createBeacon() } });
`,

  "smoke.mjs": `import assert from "node:assert/strict";

// Vue and Solid render on a server with no session opened: a status read is idle there.
const { render: renderVue } = await import("./dist-node/vue.js");
const { render: renderSolid } = await import("./dist-node/solid.js");

assert.match(await renderVue(), /<span>unknown<\\/span>/);
assert.match(renderSolid(), /unknown/);
console.log("Vue and Solid render under Node.");
`,
};
