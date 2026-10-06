import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// What each built package may import at runtime. The core imports nothing, an
// adapter only the core, and a framework binding the core and its own
// framework: a consumer of the web packages never receives a native module,
// another framework, Workbox or a SemVer library it did not ask for. The
// devtools bundle their own Solid, so the inspector imports only the core, and
// the React wrapper only the inspector, the binding it reads the Beacon from
// and React.
const CORE = "@priemskiyyy/beacon";

const DEVTOOLS = "@priemskiyyy/beacon-devtools";

const FRAMEWORKS = {
  "packages/react": "react",
  "packages/solid": "solid-js",
  "packages/vue": "vue",
  "packages/svelte": "svelte",
};

const findPackages = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);

    return existsSync(join(path, "package.json")) ? [path] : [];
  });

const packages = [
  ...findPackages("packages"),
  ...findPackages("packages/adapters"),
];

const findScripts = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findScripts(path);
    }

    // The Svelte package compiles nothing, so its tests and fixtures sit in `dist` beside the sources; `files` keeps them out of the tarball.
    if (/\.(test|fixture|contracts)\./.test(entry.name)) {
      return [];
    }

    return entry.name.endsWith(".js") ? [path] : [];
  });

// A documentation example may show an import, and only code imports at runtime.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const readImports = (source) =>
  [
    ...source.matchAll(
      /(?:from\s*|import\s*\(\s*|import\s+)["']([^"'.][^"']*)["']/g,
    ),
  ].map((match) => match[1]);

// The conformance suites are the one entry point that imports a test runner, an optional peer dependency.
const allowed = (path, file) => {
  if (path === "packages/core" && file.endsWith("/testing.js")) {
    return ["vitest"];
  }

  if (path === "packages/core") {
    return [];
  }

  if (path === "packages/devtools" && file.endsWith("/react.js")) {
    return [CORE, DEVTOOLS, "@priemskiyyy/beacon-react", "react"];
  }

  if (path === "packages/devtools") {
    return [CORE];
  }

  const framework = FRAMEWORKS[path];

  if (framework !== undefined) {
    return [CORE, framework];
  }

  return [CORE];
};

const isAllowed = (specifier, list) =>
  list.some((name) => specifier === name || specifier.startsWith(`${name}/`));

let checked = 0;

for (const path of packages) {
  const dist = join(path, "dist");

  assert(existsSync(dist), `${path} is not built: run pnpm build first.`);

  for (const file of findScripts(dist)) {
    const imports = readImports(stripComments(readFileSync(file, "utf8")));

    for (const specifier of imports) {
      // BIND-10 A built package imports only what its role allows, so a web consumer receives no native module, framework, Workbox or SemVer library.
      assert(
        isAllowed(specifier, allowed(path, file)),
        `${file} imports "${specifier}", which ${path} may not.`,
      );
    }

    checked += 1;
  }
}

// The wrapper reaches the inspector by its name, so a host bundles one copy of it, and only the wrapper is a client component.
const devtools = (file) =>
  readFileSync(join("packages/devtools/dist", file), "utf8");

assert(
  !devtools("react.js").includes("already mounted"),
  "The devtools React wrapper bundled a second copy of the inspector.",
);
assert(
  devtools("react.js").startsWith('"use client";'),
  "The devtools React wrapper lost its client directive.",
);
assert(
  !devtools("index.js").includes("use client"),
  "The devtools inspector is framework independent and carries no client directive.",
);
assert(
  !/use client/.test(devtools("react.d.ts")),
  "A client directive reached the devtools declarations.",
);

console.log(
  `Verified the imports of ${checked} built files in ${packages.length} packages.`,
);
