import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  extractTarball,
  packWorkspace,
  run,
  workspace,
} from "./packWorkspace.mjs";

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

// A package may read the core's root and its `adapter`, `versions` and `triggers` entries; the mock and the conformance suites are for a test, and what ships never imports them.
const TEST_ENTRIES = [`${CORE}/mock`, `${CORE}/testing`];

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
      assert(
        !isAllowed(specifier, TEST_ENTRIES),
        `${file} imports "${specifier}", a test helper of the core that shipped code never reads.`,
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

// What a stranger receives. Each package is packed the way pnpm publishes it, staged in
// `.artifacts/release/<name>/` with a checksum (the publish workflow publishes exactly
// those tarballs), linted, and read back out of the tarball: nothing below looks at the
// source tree.
const LIMITS = { packed: 400 * 1024, unpacked: 2 * 1024 * 1024 };

// Whatever else `files` lets through is a mistake.
const TARBALL_FILES = ["package.json", "README.md", "LICENSE"];

// A tarball ships no test, fixture, contract, source or tooling file.
const NEVER_SHIPPED =
  /(?:^|\/)(?:src|test|tests|__tests__|node_modules|\.git)\/|\.(?:test|spec|fixture|contracts)\.|(?:^|\/)(?:tsconfig[^/]*\.json|tsdown\.config\.[cm]?[jt]s|vite\.config\.[cm]?[jt]s|\.npmrc|\.env[^/]*)$/;

// Nothing that names the machine or the workspace that built the package.
const WORKSPACE_LEAKS = [
  [/\/home\/|\/Users\/|\/tmp\/|\.[^/]+\/worktrees|C:\\Users/, "a local path"],
  [/node_modules\//, "a node_modules path"],
  [/from\s*["']src\//, "a src alias import"],
  [/import\(\s*["']src\//, "a src alias import"],
  [
    /from\s*["']\.\.\/\.\.?\/(?:packages|src|core)\b/,
    "a workspace-relative import",
  ],
  [/workspace:/, "a workspace: range"],
];

const readSpecifiers = (source) =>
  [
    ...source.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"'.][^"']*)["']/g,
    ),
  ].map((match) => match[1]);

const readRelativeSpecifiers = (source) =>
  [
    ...source.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.\.?\/[^"']*)["']/g,
    ),
  ].map((match) => match[1]);

// A relative import is a file of the tarball, as written or with the extension a bundler or a compiler would add.
const resolvesInside = (files, file, specifier) => {
  const target = join(file, "..", specifier);

  return [
    target,
    target.replace(/\.js$/, ".d.ts"),
    `${target}.js`,
    `${target}.d.ts`,
    `${target}.svelte`,
    join(target, "index.js"),
    join(target, "index.d.ts"),
  ].some((candidate) => files.includes(candidate));
};

const packageNameOf = (specifier) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

const listTree = (directory, prefix = "") =>
  readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        return listTree(directory, relative);
      }

      return [relative];
    },
  );

// Declared in the manifest, so an install brings it or tells the consumer to.
const readDeclared = (manifest) =>
  new Set([
    manifest.name,
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

const collectTargets = (value) => {
  if (typeof value === "string") {
    return [value];
  }

  if (value === null || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap(collectTargets);
};

// The Svelte package compiles nothing: its declarations name the `.svelte` files
// beside them, which Node's own TypeScript resolution cannot follow (svelte-check
// can), so attw reports that one rule for it and no other package.
const ATTW_IGNORES = {
  "@priemskiyyy/beacon-svelte": ["internal-resolution-error"],
};

const lintTarball = (name, tarball) => {
  const strict = run("pnpm", ["exec", "publint", tarball, "--strict"]);

  assert(
    strict.includes("All good!"),
    `publint reported on ${name}:\n${strict}`,
  );

  // Every package is ESM only (`"type": "module"`, an `import` and a `default` condition at the same file),
  // so `--profile esm-only` ignores the two resolutions an ESM-only package cannot satisfy by design: a
  // `require` under node16, and node10 (`moduleResolution: "node"`), which reads no `exports` and so cannot
  // find a subpath's types. Everything else, the bundler and node16-from-ESM resolutions, must be green.
  const ignored = (ATTW_IGNORES[name] ?? []).flatMap((rule) => [
    "--ignore-rules",
    rule,
  ]);

  run("pnpm", ["exec", "attw", tarball, "--profile", "esm-only", ...ignored]);
};

const checkManifest = (packed, directory, files) => {
  const { name } = packed;

  const manifest = JSON.parse(
    readFileSync(join(directory, "package.json"), "utf8"),
  );

  // pnpm rewrites `workspace:` when it packs; a tarball that kept one cannot be installed by anyone.
  assert(
    !JSON.stringify(manifest).includes("workspace:"),
    `${name} kept a workspace: range in its packed manifest.`,
  );

  assert.equal(
    Object.keys(manifest.dependencies ?? {}).length,
    0,
    `${name} has runtime dependencies: a provider SDK is the application's, and the core has none.`,
  );

  for (const hook of ["preinstall", "install", "postinstall"]) {
    assert(
      manifest.scripts?.[hook] === undefined,
      `${name} runs ${hook} on the consumer's machine.`,
    );
  }

  assert.equal(manifest.type, "module", `${name} is ESM only and must say so.`);

  // Every entry the manifest names exists in the tarball, and a file a consumer is pointed at is never missing.
  for (const target of [
    ...collectTargets(manifest.exports),
    ...collectTargets(manifest.main),
    ...collectTargets(manifest.types),
    ...collectTargets(manifest.svelte),
  ]) {
    assert(
      files.includes(target.replace(/^\.\//, "")),
      `${name} points at ${target}, which the tarball does not contain.`,
    );
  }

  // `types` leads every entry, or TypeScript never reaches it. A `default` beside `import`, at the same file, is what Jest and other resolvers that ask for `require` or nothing find; the Svelte package ships sources under its own condition.
  assert.equal(
    manifest.exports?.["./package.json"],
    "./package.json",
    `${name} does not export its package.json: tools that read an installed package's version, such as Expo's and React Native's, resolve it through exports.`,
  );

  for (const [subpath, entry] of Object.entries(manifest.exports ?? {})) {
    if (subpath === "./package.json") {
      continue;
    }

    assert.equal(
      Object.keys(entry)[0],
      "types",
      `${name} ${subpath} must list its types condition first.`,
    );

    if (name === "@priemskiyyy/beacon-svelte") {
      assert.deepEqual(Object.keys(entry), ["types", "svelte"]);
    } else {
      assert.deepEqual(
        Object.keys(entry),
        ["types", "import", "default"],
        `${name} ${subpath} must have the conditions types, import and default.`,
      );
      assert.equal(
        entry.import,
        entry.default,
        `${name} ${subpath} points import and default at different files.`,
      );
    }
  }

  return manifest;
};

const checkContents = (packed, directory, files, manifest) => {
  const { name } = packed;

  for (const file of files) {
    assert(
      TARBALL_FILES.includes(file) || file.startsWith("dist/"),
      `${name} ships ${file}, which is neither dist nor a metadata file.`,
    );
    assert(!NEVER_SHIPPED.test(file), `${name} ships ${file}.`);
  }

  for (const file of TARBALL_FILES) {
    assert(files.includes(file), `${name} ships no ${file}.`);
  }

  assert.equal(
    readFileSync(join(directory, "LICENSE"), "utf8"),
    readFileSync(join(workspace, "LICENSE"), "utf8"),
    `${name} ships a LICENSE that is not the repository's.`,
  );

  // The README tells a reader how to install this package, by its name.
  const readme = readFileSync(join(directory, "README.md"), "utf8");

  assert(
    new RegExp(
      `(?:pnpm add|npm install|npm i|yarn add|bun add)\\b[^\\n]*${name}(?:\\s|$)`,
    ).test(readme),
    `The README of ${name} has no install line for it.`,
  );

  const declared = readDeclared(manifest);
  let size = 0;

  for (const file of files) {
    size += statSync(join(directory, file)).size;

    if (!/\.(?:js|mjs|cjs|d\.ts|d\.mts|svelte)$/.test(file)) {
      continue;
    }

    const source = readFileSync(join(directory, file), "utf8");
    // A bundler's `//#region` marker names the file it bundled, and a comment is no code.
    const code = stripComments(source).replace(/^\s*\/\/.*$/gm, "");

    for (const specifier of readSpecifiers(code)) {
      // The built code and its declarations import only what the manifest declares: nothing a consumer would have to guess.
      assert(
        declared.has(packageNameOf(specifier)),
        `${name} ${file} imports "${specifier}", which its manifest does not declare.`,
      );
    }

    for (const specifier of readRelativeSpecifiers(code)) {
      assert(
        resolvesInside(files, file, specifier),
        `${name} ${file} imports "${specifier}", which is not in the tarball.`,
      );
    }

    for (const [pattern, what] of WORKSPACE_LEAKS) {
      assert(!pattern.test(code), `${name} ${file} contains ${what}.`);
    }

    if (/\.d\.m?ts$/.test(file)) {
      assert(
        !/\/\/\/\s*<reference\s/.test(code),
        `${name} ${file} has a triple-slash reference, so its types are not self-contained.`,
      );
    }

    // A map names sources a debugger can read, or it points at nothing.
    const map = /\/\/# sourceMappingURL=(\S+)\s*$/.exec(source);

    if (map !== null && !map[1].startsWith("data:")) {
      assert(
        files.includes(join("dist", map[1])) ||
          files.includes(join(file, "..", map[1])),
        `${name} ${file} points at ${map[1]}, which the tarball does not contain.`,
      );
    }
  }

  for (const file of files.filter((entry) => entry.endsWith(".map"))) {
    const map = JSON.parse(readFileSync(join(directory, file), "utf8"));

    assert(
      Array.isArray(map.sourcesContent) &&
        map.sourcesContent.length === map.sources.length,
      `${name} ${file} names sources it does not carry, so a debugger finds nothing.`,
    );
  }

  return size;
};

const scratch = mkdtempSync(join(tmpdir(), "beacon-unpacked-"));

try {
  const tarballs = packWorkspace();
  const sizes = [];

  for (const packed of tarballs) {
    const directory = extractTarball(
      packed.tarball,
      join(scratch, packed.directory),
    );

    const files = listTree(directory);

    const manifest = checkManifest(packed, directory, files);
    const unpacked = checkContents(packed, directory, files, manifest);
    const compressed = statSync(packed.tarball).size;

    assert(
      compressed <= LIMITS.packed,
      `${packed.name} packs to ${compressed} bytes, above the ${LIMITS.packed} budget.`,
    );
    assert(
      unpacked <= LIMITS.unpacked,
      `${packed.name} unpacks to ${unpacked} bytes, above the ${LIMITS.unpacked} budget.`,
    );

    lintTarball(packed.name, packed.tarball);
    sizes.push(
      `${packed.name}@${packed.version}: ${files.length} files, ${(compressed / 1024).toFixed(1)} kB packed, ${(unpacked / 1024).toFixed(1)} kB unpacked`,
    );
  }

  console.log(sizes.join("\n"));
  console.log(
    `Packed, linted and read back ${tarballs.length} tarballs into .artifacts/release.`,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
