import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  compile,
  consumersRoot,
  createConsumer,
  dispose,
  entriesDeclaration,
  finish,
  listEntries,
  step,
  tsconfig,
  writeFiles,
  writeJson,
} from "./consumers/harness.mjs";
import {
  EXPO_PACKAGES,
  expoFiles,
  expoMetroEnvironment,
} from "./consumers/expo.mjs";
import { AUTHORING_PACKAGES, authoringFiles } from "./consumers/authoring.mjs";
import { FRAMEWORK_PACKAGES, frameworkFiles } from "./consumers/frameworks.mjs";
import { JEST_PACKAGES, jestFiles } from "./consumers/jest.mjs";
import {
  NATIVE_PACKAGES,
  nativeFiles,
  nativeSdks,
} from "./consumers/native.mjs";
import {
  react18Files,
  WEB_PACKAGES,
  webFiles,
  webSmoke,
} from "./consumers/web.mjs";
import { readStagedTarballs, run, workspace } from "./packWorkspace.mjs";

// A stranger installs what the registry will serve: the tarballs the publish
// workflow publishes, put into clean folders outside this workspace with plain
// `npm install`, and then compiled, bundled and run. Each consumer below needs the
// network, so this check is not part of `pnpm check`: run `pnpm test:package`
// first, which stages the tarballs, then `pnpm test:consumers`.
const rootManifest = JSON.parse(
  readFileSync(path.join(workspace, "package.json"), "utf8"),
);

const pin = (name) => {
  const version = rootManifest.devDependencies[name];

  assert(version !== undefined, `${name} is not pinned by the workspace.`);

  return version;
};

const staged = readStagedTarballs();

const tarballs = new Map(
  staged.map((entry) => [entry.manifest.name, entry.tarball]),
);

// Every TypeScript a consumer may have: the oldest the declarations read (5.4, where `NoInfer` begins: 5.3 fails with "Cannot find name 'NoInfer'"), the workspace's own, the last 6 and the current release.
const TYPESCRIPTS = {
  typescript: pin("typescript"),
  "typescript-5-4": "npm:typescript@5.4.5",
  "typescript-6": "npm:typescript@6.0.3",
  "typescript-latest": "npm:typescript@latest",
};

// The conformance suites register with a test runner, an optional peer a web app does not install: the authoring consumer runs them.
const TESTING = "@priemskiyyy/beacon/testing";

const selected = process.argv.slice(2);
const wants = (name) => selected.length === 0 || selected.includes(name);

const readWorkspaceSurface = async (entry, name) => {
  const folder = staged.find((item) => item.manifest.name === name).folder;
  const manifest = staged.find((item) => item.manifest.name === name).manifest;
  const subpath = `.${entry.spec.slice(name.length)}`;
  const target = manifest.exports[subpath];
  const file = path.join(folder, target.import ?? target.default);

  return Object.keys(await import(pathToFileURL(file).href)).sort();
};

// Every entry of every package the consumer installed resolves under Node, has
// named exports only, and is what the workspace built.
const checkEntries = async (directory, names, { skip = [] } = {}) => {
  const entries = listEntries(directory, names).filter(
    (entry) => !skip.includes(entry.spec),
  );

  writeFiles(directory, {
    "entries.mjs": `import { createRequire } from "node:module";
const specs = ${JSON.stringify(entries.map((entry) => entry.spec))};
const surfaces = {};
const require = createRequire(import.meta.url);
for (const name of ${JSON.stringify(names)}) {
  require.resolve(name + "/package.json");
}
for (const spec of specs) {
  const namespace = await import(spec);
  surfaces[spec] = Object.keys(namespace).sort();
}
console.log(JSON.stringify(surfaces));
`,
  });

  const surfaces = JSON.parse(run("node", ["entries.mjs"], { cwd: directory }));

  for (const entry of entries) {
    const names = surfaces[entry.spec];

    assert(names.length > 0, `${entry.spec} exports nothing at runtime.`);
    assert(
      !names.includes("default"),
      `${entry.spec} has a default export, which breaks silently under some React Native interop.`,
    );
    assert.deepEqual(
      names,
      await readWorkspaceSurface(entry, entry.name),
      `${entry.spec} is not what the workspace built.`,
    );
  }

  return entries;
};

// Exactly one copy of the core, however many packages sit on it.
const checkSingleCore = (directory, names) => {
  for (const name of names) {
    assert(
      !existsSync(
        path.join(directory, "node_modules", name, "node_modules/@priemskiyyy"),
      ),
      `${name} installed a copy of a Beacon package of its own.`,
    );
  }

  // The installed tree is a valid one: no missing or invalid peer of ours.
  run("npm", ["ls", "--all", ...names, "--omit=dev"], { cwd: directory });
};

const compileAll = (directory, include, { jsx, lib, types } = {}) => {
  const matrix = [
    ["bundler", "ESNext", "Bundler"],
    ["node16", "Node16", "Node16"],
    ["nodenext", "NodeNext", "NodeNext"],
  ];

  for (const [label, module, moduleResolution] of matrix) {
    writeJson(
      directory,
      `tsconfig.${label}.json`,
      tsconfig({ module, moduleResolution, include, jsx, lib, types }),
    );

    for (const typescript of Object.keys(TYPESCRIPTS)) {
      compile(directory, typescript, `tsconfig.${label}.json`);
    }
  }
};

// The declarations alone, with no ambient types and every library file checked: if one named a type the package does not declare, a path of this workspace or a dependency it did not list, this fails.
const compileDeclarations = (directory, entries, { skip = [] } = {}) => {
  writeFiles(directory, { "entries.d.ts": entriesDeclaration(entries) });
  writeJson(
    directory,
    "tsconfig.declarations.json",
    tsconfig({
      module: "ESNext",
      moduleResolution: "Bundler",
      include: ["entries.d.ts"],
      // The declarations name `AbortSignal` as a platform global, as every fetch-shaped API does: the DOM library, @types/node or React Native's own types provide it.
      lib: ["ES2022", "DOM"],
    }),
  );

  for (const typescript of Object.keys(TYPESCRIPTS)) {
    if (!skip.includes(typescript)) {
      compile(directory, typescript, "tsconfig.declarations.json");
    }
  }
};

const webConsumer = async ({ name, packages, react, files }) => {
  const directory = await step("install the tarballs and their peers", () =>
    createConsumer({
      name,
      packages,
      tarballs,
      dependencies: {
        react: react.react,
        "react-dom": react.react,
        "@types/react": react.types,
        "@types/react-dom": react.domTypes,
        vite: pin("vite"),
        ...TYPESCRIPTS,
      },
    }),
  );

  await step("the tree is valid and holds one core", () =>
    checkSingleCore(directory, packages),
  );

  const entries = await step("every entry resolves under Node ESM", () =>
    checkEntries(directory, packages, { skip: [TESTING] }),
  );

  writeFiles(directory, {
    ...files,
    "entries.d.ts": entriesDeclaration(entries),
    "smoke.mjs": webSmoke,
  });

  await step(
    "the app compiles strictly under bundler, node16 and nodenext, on every TypeScript",
    () => compileAll(directory, ["src", "entries.d.ts"], { types: [] }),
  );

  await step("a packed manifest, a reload and a render run under Node", () => {
    process.stdout.write(`\n${run("node", ["smoke.mjs"], { cwd: directory })}`);
  });

  await step("vite builds the app", () => {
    run(
      process.execPath,
      [path.join(directory, "node_modules/vite/bin/vite.js"), "build"],
      { cwd: directory },
    );

    const assets = readdirSync(path.join(directory, "dist/assets"));
    const script = assets.find((file) => file.endsWith(".js"));

    assert(script !== undefined, "vite emitted no script.");

    const bundle = readFileSync(
      path.join(directory, "dist/assets", script),
      "utf8",
    );

    // The conformance suites are a test runner's and the inspector is development-only: neither reaches a production bundle.
    assert(!bundle.includes("vitest"), "The bundle imports vitest.");
    assert(
      !bundle.includes("data-beacon-devtools"),
      "The inspector reached the production bundle.",
    );
  });

  dispose(directory);
};

const authoringConsumer = async ({ name, vitest }) => {
  const directory = await step(`install the core with Vitest ${vitest}`, () =>
    createConsumer({
      name,
      // npm 10 crashes resolving Vitest 4's own peers (`Cannot read properties of null (reading 'edgesOut')`), with or without a Beacon package.
      manager: "pnpm",
      packages: AUTHORING_PACKAGES,
      tarballs,
      dependencies: {
        vitest: vitest,
        typescript: pin("typescript"),
      },
    }),
  );

  writeFiles(directory, authoringFiles);

  await step("the author's project typechecks", () => {
    compile(directory, "typescript", "tsconfig.json");
  });

  await step("the conformance suites run over a mechanism of its own", () => {
    process.stdout.write(
      `\n${run(process.execPath, [path.join(directory, "node_modules/vitest/vitest.mjs"), "run"], { cwd: directory, env: { CI: "1" }, merge: true })}`,
    );
  });

  dispose(directory);
};

const consumers = {
  web: () =>
    webConsumer({
      name: "web",
      packages: WEB_PACKAGES,
      files: webFiles,
      react: {
        react: pin("react"),
        types: pin("@types/react"),
        domTypes: pin("@types/react-dom"),
      },
    }),

  // The floor of the React peer range, with the inspector left out: it asks for React 19.2.
  react18: () =>
    webConsumer({
      name: "react18",
      packages: WEB_PACKAGES.filter((name) => !name.endsWith("-devtools")),
      files: react18Files,
      react: {
        react: "18.3.1",
        types: "18.3.31",
        domTypes: "18.3.7",
      },
    }),

  expo: async () => {
    const directory = await step(
      "install the tarballs, the Expo SDK and their peers",
      () =>
        createConsumer({
          name: "expo",
          type: "commonjs",
          packages: EXPO_PACKAGES,
          tarballs,
          dependencies: {
            expo: pin("expo-updates"),
            "expo-updates": pin("expo-updates"),
            "expo-application": pin("expo-application"),
            react: pin("react"),
            "react-native": pin("react-native"),
            "@types/react": pin("@types/react"),
            ...TYPESCRIPTS,
          },
        }),
    );

    await step("the tree is valid and holds one core", () =>
      checkSingleCore(directory, EXPO_PACKAGES),
    );

    const entries = await step("every entry resolves under Node ESM", () =>
      checkEntries(directory, EXPO_PACKAGES, { skip: [TESTING] }),
    );

    await step("the declarations are self-contained on every TypeScript", () =>
      compileDeclarations(directory, entries),
    );

    writeFiles(directory, expoFiles);

    await step(
      "the app compiles strictly against expo-updates, expo-application and react-native",
      () => {
        compile(directory, "typescript", "tsconfig.json");
      },
    );

    await step("Metro bundles it for iOS and Android", () => {
      run(
        process.execPath,
        [
          path.join(directory, "node_modules/expo/bin/cli"),
          "export",
          "--platform",
          "ios",
          "--platform",
          "android",
          "--output-dir",
          "dist",
        ],
        { cwd: directory, env: expoMetroEnvironment },
      );

      for (const platform of ["ios", "android"]) {
        const folder = path.join(directory, "dist/_expo/static/js", platform);

        const bundle = readdirSync(folder).find((file) =>
          file.endsWith(".hbc"),
        );

        assert(bundle !== undefined, `Metro emitted no ${platform} bundle.`);

        const bytes = readFileSync(path.join(folder, bundle), "latin1");

        assert(
          bytes.includes("BeaconError"),
          `The ${platform} bundle holds no Beacon.`,
        );
        assert(
          !bytes.includes("vitest"),
          `The ${platform} bundle imports vitest.`,
        );
      }
    });

    dispose(directory);
  },

  native: async () => {
    const directory = await step(
      "install the tarballs with the native SDKs and their peers",
      () =>
        createConsumer({
          name: "native",
          type: "commonjs",
          packages: NATIVE_PACKAGES,
          tarballs,
          dependencies: {
            ...Object.fromEntries(nativeSdks.map((name) => [name, pin(name)])),
            react: pin("react"),
            "react-native": pin("react-native"),
            "@types/react": pin("@types/react"),
            ...TYPESCRIPTS,
          },
        }),
    );

    await step("the tree is valid and holds one core", () =>
      checkSingleCore(directory, NATIVE_PACKAGES),
    );

    const entries = await step("every entry resolves under Node ESM", () =>
      checkEntries(directory, NATIVE_PACKAGES, { skip: [TESTING] }),
    );

    await step("the declarations are self-contained on every TypeScript", () =>
      compileDeclarations(directory, entries),
    );

    writeFiles(directory, nativeFiles);

    await step("the adapters typecheck against the real SDKs", () => {
      compile(directory, "typescript", "tsconfig.json");
    });

    dispose(directory);
  },

  frameworks: async () => {
    const directory = await step(
      "install the tarballs with Vue, Solid and Svelte",
      () =>
        createConsumer({
          name: "frameworks",
          packages: FRAMEWORK_PACKAGES,
          tarballs,
          dependencies: {
            vue: pin("vue"),
            "solid-js": pin("solid-js"),
            svelte: pin("svelte"),
            vite: pin("vite"),
            "@sveltejs/vite-plugin-svelte": pin("@sveltejs/vite-plugin-svelte"),
            "svelte-check": pin("svelte-check"),
            ...TYPESCRIPTS,
          },
        }),
    );

    await step("the tree is valid and holds one core", () =>
      checkSingleCore(directory, FRAMEWORK_PACKAGES),
    );

    // The Svelte package ships sources for the application's compiler, which plain Node cannot import.
    const entries = await step("every entry resolves under Node ESM", () =>
      checkEntries(
        directory,
        FRAMEWORK_PACKAGES.filter((name) => !name.endsWith("-svelte")),
        { skip: [TESTING] },
      ),
    );

    await step("the declarations of the others are self-contained", () =>
      // Solid's own declarations need a DOM library newer than the floor TypeScript's, and they are checked whole here.
      compileDeclarations(directory, entries, { skip: ["typescript-5-4"] }),
    );

    writeFiles(directory, frameworkFiles);

    await step(
      "the apps typecheck, and svelte-check reads the Svelte one",
      () => {
        compile(directory, "typescript", "tsconfig.json");
        run(
          process.execPath,
          [
            path.join(directory, "node_modules/svelte-check/bin/svelte-check"),
            "--tsconfig",
            "./tsconfig.json",
            "--fail-on-warnings",
          ],
          { cwd: directory },
        );
      },
    );

    await step("Vue and Solid render on a server under Node", () => {
      compile(directory, "typescript", "tsconfig.node.json");
      process.stdout.write(
        `\n${run("node", ["smoke.mjs"], { cwd: directory })}`,
      );
    });

    await step("vite compiles the Svelte sources into a build", () => {
      run(
        process.execPath,
        [path.join(directory, "node_modules/vite/bin/vite.js"), "build"],
        { cwd: directory },
      );

      assert(
        readdirSync(path.join(directory, "dist/assets")).some((file) =>
          file.endsWith(".js"),
        ),
        "vite emitted no script.",
      );
    });

    dispose(directory);
  },

  // The conformance suites run on the Vitest the workspace pins and on the next major, which the core's peer range must admit.
  authoring: () =>
    authoringConsumer({ name: "authoring", vitest: pin("vitest") }),

  authoring5: () => authoringConsumer({ name: "authoring5", vitest: "5.0.3" }),

  jest: async () => {
    const directory = await step(
      "install the tarballs with jest-expo and their peers",
      () =>
        createConsumer({
          name: "jest",
          type: "commonjs",
          packages: JEST_PACKAGES,
          tarballs,
          dependencies: {
            expo: pin("expo-updates"),
            "expo-updates": pin("expo-updates"),
            react: pin("react"),
            "react-native": pin("react-native"),
            "@react-native/jest-preset": pin("react-native"),
            "jest-expo": "57.0.5",
            jest: "29.7.0",
            // The version jest-expo itself depends on, so one renderer is installed.
            "react-test-renderer": "19.2.3",
          },
        }),
    );

    writeFiles(directory, jestFiles);

    await step("jest runs the tests through the provider", () => {
      process.stdout.write(
        `\n${run(process.execPath, [path.join(directory, "node_modules/jest/bin/jest.js"), "--ci"], { cwd: directory, env: { CI: "1" }, merge: true })}`,
      );
    });

    dispose(directory);
  },
};

try {
  console.log(`Consumers are installed in ${consumersRoot}.`);

  for (const [name, consumer] of Object.entries(consumers)) {
    if (wants(name)) {
      console.log(`${name} consumer`);
      await consumer();
    }
  }

  console.log(
    "Every consumer installed, compiled and ran the packed packages.",
  );
} finally {
  finish();
}
