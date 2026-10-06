import { svelte } from "@sveltejs/vite-plugin-svelte";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import { configDefaults, defineConfig } from "vitest/config";
import type { TestProjectConfiguration } from "vitest/config";

type ProjectOptions = {
  environment: "node" | "jsdom";
  dedupe: string[];
  include: string[];
  exclude: string[];
};

// Solid, Vue and Svelte each need their own build of the framework, and a
// binding's server render and its hydration need theirs again, so they are
// projects of their own below. The devtools are Solid too, and have theirs.
const FRAMEWORKS = ["solid", "vue", "svelte", "devtools"];

const PROJECT_OPTIONS: Record<string, Partial<ProjectOptions>> = {
  // A binding must render against the same React instance as the renderer under test.
  react: { environment: "jsdom", dedupe: ["react", "react-dom"] },
  "example-react": { environment: "jsdom", dedupe: ["react", "react-dom"] },
};

// An example keeps its tests next to its code, not under `src`, and a project of its own never shares a name with a package.
const isExample = (directory: string) => directory === "examples";

const project = (directory: string, folder: string) => {
  const name = isExample(directory) ? `example-${folder}` : folder;
  const options = PROJECT_OPTIONS[name] ?? {};
  const root = `${directory}/${folder}`;
  const tests = isExample(directory) ? root : `${root}/src`;

  return {
    extends: true,
    resolve: {
      alias: { src: fileURLToPath(new URL(`./${root}/src`, import.meta.url)) },
      dedupe: options.dedupe ?? [],
    },
    test: {
      name,
      include: (options.include ?? ["**/*.test.{ts,tsx}"]).map(
        (pattern) => `${tests}/${pattern}`,
      ),
      exclude: [...configDefaults.exclude, ...(options.exclude ?? [])],
      environment: options.environment ?? "node",
    },
  } satisfies TestProjectConfiguration;
};

// Every package is an ordinary project named after its folder, so a new one is
// tested without being listed here.
const discover = (directory: string) => {
  const root = new URL(`./${directory}`, import.meta.url);

  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((name) => {
    if (FRAMEWORKS.includes(name)) {
      return [];
    }

    const manifest = new URL(
      `./${directory}/${name}/package.json`,
      import.meta.url,
    );

    if (!existsSync(manifest)) {
      return [];
    }

    return [project(directory, name)];
  });
};

const aliasOf = (name: string) => ({
  src: fileURLToPath(new URL(`./packages/${name}/src`, import.meta.url)),
});

const frameworkProjects = [
  {
    extends: true,
    resolve: {
      alias: aliasOf("solid"),
      // Node would resolve Solid's server build, which never runs effects.
      conditions: ["development", "browser"],
      dedupe: ["solid-js"],
    },
    test: {
      name: "solid",
      include: ["packages/solid/src/**/*.test.{ts,tsx}"],
      exclude: [
        ...configDefaults.exclude,
        "**/*.server.test.tsx",
        "**/hydration.test.tsx",
      ],
      environment: "jsdom",
      server: { deps: { inline: [/solid-js/] } },
    },
  },
  {
    extends: true,
    plugins: [solid({ ssr: true })],
    resolve: { alias: aliasOf("solid") },
    test: {
      name: "solid-ssr",
      include: ["packages/solid/src/**/*.server.test.tsx"],
      environment: "node",
    },
  },
  {
    extends: true,
    // In jsdom this compiles hydratable DOM output, which claims the markup the server test pins.
    plugins: [solid({ ssr: true })],
    resolve: {
      alias: aliasOf("solid"),
      conditions: ["development", "browser"],
      dedupe: ["solid-js"],
    },
    test: {
      name: "solid-hydration",
      include: ["packages/solid/src/**/hydration.test.tsx"],
      environment: "jsdom",
      server: { deps: { inline: [/solid-js/] } },
    },
  },
  {
    extends: true,
    resolve: { alias: aliasOf("vue"), dedupe: ["vue"] },
    test: {
      name: "vue",
      include: ["packages/vue/src/**/*.test.ts"],
      exclude: [...configDefaults.exclude, "**/*.server.test.ts"],
      environment: "jsdom",
    },
  },
  {
    extends: true,
    resolve: { alias: aliasOf("vue"), dedupe: ["vue"] },
    test: {
      name: "vue-ssr",
      include: ["packages/vue/src/**/*.server.test.ts"],
      environment: "node",
    },
  },
  {
    extends: true,
    plugins: [svelte({ configFile: false })],
    // The client build, where effects run.
    resolve: { conditions: ["browser"] },
    test: {
      name: "svelte",
      include: ["packages/svelte/src/**/*.test.ts"],
      exclude: [...configDefaults.exclude, "**/*.server.test.ts"],
      environment: "jsdom",
    },
  },
  {
    extends: true,
    plugins: [svelte({ configFile: false })],
    test: {
      name: "svelte-ssr",
      include: ["packages/svelte/src/**/*.server.test.ts"],
      environment: "node",
    },
  },
] satisfies TestProjectConfiguration[];

// The inspector is compiled as its bundle is, with Solid's browser build so
// effects run in jsdom, and its React wrapper renders against the same React
// as the binding it reads the Beacon from.
const devtoolsProject = {
  extends: true,
  plugins: [solid({ solid: { delegateEvents: false } })],
  resolve: {
    alias: {
      ...aliasOf("devtools"),
      // The wrapper imports the inspector by its package name, which resolves to the source here.
      "@priemskiyyy/beacon-devtools": fileURLToPath(
        new URL("./packages/devtools/src/index.ts", import.meta.url),
      ),
    },
    conditions: ["development", "browser"],
    dedupe: ["react", "react-dom", "solid-js"],
  },
  test: {
    name: "devtools",
    include: ["packages/devtools/src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    server: { deps: { inline: [/solid-js/] } },
  },
} satisfies TestProjectConfiguration;

export default defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    projects: [
      ...discover("packages"),
      ...discover("packages/adapters"),
      ...discover("examples"),
      devtoolsProject,
      ...frameworkProjects,
    ],
  },
});
