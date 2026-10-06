import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { run } from "../packWorkspace.mjs";

const keep = process.env.BEACON_KEEP_CONSUMERS === "1";

/** Every consumer is installed here, outside the repository: no workspace link can reach it. */
export const consumersRoot =
  process.env.BEACON_CONSUMER_DIR ??
  mkdtempSync(path.join(tmpdir(), "beacon-consumers-"));

export const finish = () => {
  if (!keep && process.env.BEACON_CONSUMER_DIR === undefined) {
    rmSync(consumersRoot, { recursive: true, force: true });
  }
};

export const writeFiles = (directory, files) => {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(directory, name);

    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
};

export const writeJson = (directory, name, value) =>
  writeFiles(directory, { [name]: `${JSON.stringify(value, null, 2)}\n` });

/** Runs a step and says how long it took. A failure carries the step's name. */
export const step = async (name, action) => {
  const started = Date.now();

  process.stdout.write(`  ${name} ...`);

  try {
    const result = await action();

    process.stdout.write(
      ` ok (${((Date.now() - started) / 1000).toFixed(1)}s)\n`,
    );

    return result;
  } catch (error) {
    process.stdout.write(" FAILED\n");

    throw new Error(`${name}: ${error.message}`, { cause: error });
  }
};

/**
 * Makes a consumer folder and installs the packed tarballs with the registry
 * packages beside them, by plain `npm install`: no workspace, no link, no
 * `--legacy-peer-deps` and no `--force`, so a peer range that cannot be met is an
 * install failure here as it would be for a stranger.
 */
export const createConsumer = ({
  name,
  packages,
  dependencies,
  tarballs,
  type = "module",
  manager = "npm",
}) => {
  const directory = path.join(consumersRoot, name);

  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  const files = Object.fromEntries(
    packages.map((packageName) => {
      const tarball = tarballs.get(packageName);

      if (tarball === undefined) {
        throw new Error(`${packageName} has no staged tarball.`);
      }

      return [packageName, `file:${tarball}`];
    }),
  );

  writeJson(directory, "package.json", {
    name: `beacon-consumer-${name}`,
    private: true,
    // An Expo or React Native project is CommonJS unless it says otherwise; a Vite one is a module.
    ...(type === "module" ? { type } : {}),
    dependencies: { ...files, ...dependencies },
  });

  if (manager === "pnpm") {
    // pnpm still resolves peers itself: strictly, as npm does, so a range that cannot be met fails here.
    run(
      "pnpm",
      [
        "install",
        "--ignore-scripts",
        "--strict-peer-dependencies",
        "--reporter=silent",
        "--no-frozen-lockfile",
      ],
      { cwd: directory },
    );

    return directory;
  }

  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--no-update-notifier",
      "--ignore-scripts",
      "--loglevel=error",
    ],
    { cwd: directory },
  );

  return directory;
};

export const dispose = (directory) => {
  if (!keep) {
    rmSync(directory, { recursive: true, force: true });
  }
};

export const readInstalled = (directory, name) =>
  JSON.parse(
    readFileSync(
      path.join(directory, "node_modules", name, "package.json"),
      "utf8",
    ),
  );

/** Every entry an installed package publishes, as `{ spec, target }`. */
export const listEntries = (directory, names) =>
  names.flatMap((name) => {
    const manifest = readInstalled(directory, name);

    return Object.entries(manifest.exports)
      .filter(([subpath]) => subpath !== "./package.json")
      .map(([subpath, conditions]) => ({
        name,
        spec: `${name}${subpath.slice(1)}`,
        conditions,
      }));
  });

/** A declaration file naming the type of every entry: if one fails to resolve, or is not valid, `tsc` says which. */
export const entriesDeclaration = (entries) =>
  `export type Entries = [\n${entries
    .map((entry) => `  typeof import("${entry.spec}"),`)
    .join("\n")}\n];\n`;

/** A `tsconfig.json` under one resolution mode, and strict enough that a loose declaration shows. */
export const tsconfig = ({
  module,
  moduleResolution,
  include,
  jsx = "react-jsx",
  lib = ["ES2022", "DOM", "DOM.Iterable"],
  types = [],
  skipLibCheck = false,
}) => ({
  compilerOptions: {
    target: "ES2022",
    lib,
    module,
    moduleResolution,
    jsx,
    types,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    noImplicitOverride: true,
    skipLibCheck,
    noEmit: true,
  },
  include,
});

/** Compiles a consumer with one TypeScript, found by the name it was installed under. */
export const compile = (directory, typescript, project) =>
  run(
    process.execPath,
    [
      path.join(directory, "node_modules", typescript, "bin", "tsc"),
      "-p",
      project,
    ],
    { cwd: directory },
  );
