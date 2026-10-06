import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// What each built package may import at runtime. The core imports nothing, an
// adapter only the core, and the React binding the core and React: a consumer
// of the web packages never receives a native module, React, Workbox or a
// SemVer library it did not ask for.
const CORE = "@priemskiyyy/beacon";

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

  if (path === "packages/react") {
    return [CORE, "react"];
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
      // BIND-10 A built package imports only what its role allows, so a web consumer receives no native module, React, Workbox or SemVer library.
      assert(
        isAllowed(specifier, allowed(path, file)),
        `${file} imports "${specifier}", which ${path} may not.`,
      );
    }

    checked += 1;
  }
}

console.log(
  `Verified the imports of ${checked} built files in ${packages.length} packages.`,
);
