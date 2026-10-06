import { spawn } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspacePackages } from "./readWorkspacePackages.mjs";

// Every `ts` and `tsx` fence in a JSDoc block of a workspace package's source,
// such as an `@example`, compiles against the built declarations of the
// workspace, as a reader who pastes it into an application would have them.
// Run `pnpm build` first.
//
// - A name an example uses without declaring it is imported, as its reader
//   would, from the package the example belongs to, else from the core, else
//   from the one other package that exports it.
// - Names an application would declare are in `snippets.ambient.d.ts`, above
//   its `snippets: readme-only` line. Its `beacon` also has the routes the
//   adapters' examples name, and every binding's `Register` knows that Beacon.
// - A name nothing declares is an example leaving a value to the reader, and
//   must be listed in PLACEHOLDERS. A name that is misspelled or renamed in an
//   example fails, and so does a placeholder no example leaves out any more.
//   What a placeholder calls back with is `any`, so `noImplicitAny` is off.
// - An example that augments a module runs alone, since two augmentations of
//   one `Register` cannot share a program.
// - Not checked: a `vue` fence, which is a template with no script.
const workspace = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(workspace, ".artifacts/jsdoc");

const typescript = path.join(workspace, "node_modules/typescript/bin/tsc");

const READMES_ONLY = "// snippets: readme-only";

const CORE = "@priemskiyyy/beacon";

// What an example leaves to the application: its own types, values and code, none of it part of the API.
const PLACEHOLDERS = new Set(
  [
    // Types the application declares.
    "Browser Decision Flow Lookup Manifest PlayBody ReloadReceipt Revision Store UpdateBody Updates UpdatesNative",
    // Constants and modules it imports.
    "APP_LABEL BUILD_ID BUILD_IDENTITY Linking PlayUpdates api createSignal events expect playBridge",
    // Components and functions of its own.
    "Application BeaconProvider evaluateSupport fetchManifest parseDecision parseLookup parseManifestResponse parseRevision readWebRelease showBanner",
    // What a test of its own builds.
    "fakeBackend fakeBridge fakePlatform fakeUpdates fakeWindow",
    // The values the code around the example holds.
    "appId backend bridge browser buildNumbers candidate check commands context current devtools dirty drafts identity lease linking lookup manifest mechanism mock nextBeacon observation offer ota participant read ref registration relaunch release reload reservation resume response routes running signal source state storage text trains updates web",
  ].flatMap((names) => names.split(" ")),
);

const packages = readWorkspacePackages(workspace);

const paths = Object.fromEntries([
  ...packages.flatMap(({ entries }) =>
    entries.map(({ module, declaration }) => [module, [declaration]]),
  ),
  ["src/*", ["./src/*"]],
]);

if (paths[CORE] === undefined) {
  console.error(
    "The core is not built: run `pnpm build` first, so the examples compile against its declarations.",
  );
  process.exit(1);
}

// What each package's entry points export, so an example may use an exported name without importing it.
const readNames = (source) => {
  const text = readFileSync(source, "utf8");

  const listed = [...text.matchAll(/export (?:type )?\{([^}]*)\}/g)]
    .flatMap(([, list]) => list.split(","))
    .map((piece) =>
      piece
        .trim()
        .split(/\s+as\s+/)
        .at(-1),
    );

  const declared = [
    ...text.matchAll(/^export (?:const|function|class|type) (\w+)/gm),
  ].map(([, name]) => name);

  return new Set([...listed, ...declared].filter((name) => name !== ""));
};

const exportsOf = new Map(
  packages.map(({ name, entries }) => [
    name,
    entries.map(({ module, source }) => ({
      module,
      source,
      names: readNames(source),
    })),
  ]),
);

// The entry that exports a name, preferring the one an example is written in.
const findEntry = (entries, name, file) => {
  const holding = entries.filter(({ names }) => names.has(name));

  return holding.find(({ source }) => source === file) ?? holding[0];
};

const listSources = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSources(file);
    }

    if (
      !/\.tsx?$/.test(entry.name) ||
      /\.(test|fixture|contracts|d)\./.test(entry.name)
    ) {
      return [];
    }

    return [file];
  });

// The fences of every JSDoc block of a file, with the line of the file each one opens on.
const readSnippets = (file, owner) => {
  const text = readFileSync(file, "utf8");

  return [...text.matchAll(/\/\*\*[\s\S]*?\*\//g)].flatMap((block) => {
    const first = text.slice(0, block.index).split("\n").length;

    const lines = block[0]
      .split("\n")
      .map((line) => line.replace(/^\s*\/?\*+\/?\s?/, ""));

    return lines.flatMap((line, index) => {
      const fence = /^```(ts|tsx)$/.exec(line.trim());

      if (fence === null) {
        return [];
      }

      const end = lines.findIndex(
        (candidate, at) => at > index && candidate.trim() === "```",
      );

      if (end === -1) {
        throw new Error(
          `${path.relative(workspace, file)}:${first + index} opens a fence that never closes.`,
        );
      }

      return [
        {
          file,
          line: first + index,
          extension: fence[1],
          owner,
          text: lines.slice(index + 1, end).join("\n"),
        },
      ];
    });
  });
};

const snippets = packages.flatMap(({ name, folder }) =>
  listSources(path.join(folder, "src")).flatMap((file) =>
    readSnippets(file, name),
  ),
);

const slug = (text) => text.replaceAll(/[^A-Za-z0-9]+/g, "_");

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const ambientText = readFileSync(
  path.join(workspace, "scripts/snippets.ambient.d.ts"),
  "utf8",
);

const DOCS_BEACON = "const beacon: BeaconClass<{ web: WebRoute }>;";

if (!ambientText.includes(DOCS_BEACON)) {
  throw new Error(`snippets.ambient.d.ts no longer declares: ${DOCS_BEACON}`);
}

// What the guides' snippets see, with the routes the adapters' examples name beside the guides' `web`, and the Vite flag a devtools example reads.
const ambientDocs = `${ambientText
  .slice(0, ambientText.indexOf(READMES_ONLY))
  .replace(
    DOCS_BEACON,
    `const beacon: BeaconClass<{
      web: WebRoute;
      ota: ReturnType<typeof expoUpdatesFactory>;
      binary: ReturnType<typeof googlePlayFactory>;
      worker: ReturnType<typeof serviceWorkerFactory>;
      update: ReturnType<typeof codePushUpdatesFactory>;
    }>;`,
  )}
import type { codePushUpdates as codePushUpdatesFactory } from "@priemskiyyy/beacon-code-push";
import type { expoUpdates as expoUpdatesFactory } from "@priemskiyyy/beacon-expo";
import type { googlePlay as googlePlayFactory } from "@priemskiyyy/beacon-google-play";
import type { serviceWorker as serviceWorkerFactory } from "@priemskiyyy/beacon-service-worker";

declare global {
  interface ImportMeta {
    readonly env: { readonly DEV: boolean };
  }
}
`;

// The bindings read the Beacon their application registered, here the one the documentation's snippets have.
const registrations = packages
  .filter(({ name }) => /-(react|solid|vue|svelte)$/.test(name))
  .map(
    ({ name }) =>
      `declare module "${name}" {\n  interface Register {\n    beacon: typeof beacon;\n  }\n}\n`,
  );

const ambients = {
  "ambient.plain.d.ts": ambientDocs,
  "ambient.registered.d.ts": `${ambientDocs}\n${registrations.join("\n")}`,
};

for (const [name, text] of Object.entries(ambients)) {
  writeFileSync(path.join(output, name), text);
}

const readAugmented = (text) =>
  [...text.matchAll(/\bdeclare module "([^"]+)"/g)].map((match) => match[1]);

// One program for the examples that augment nothing, and one for each that does.
const programs = [
  {
    name: "main",
    ambient: "ambient.registered.d.ts",
    snippets: snippets.filter(({ text }) => readAugmented(text).length === 0),
  },
  ...snippets
    .filter(({ text }) => readAugmented(text).length > 0)
    .map((snippet) => ({
      name: `augmenting_${slug(path.relative(workspace, snippet.file))}_${snippet.line}`,
      ambient: "ambient.plain.d.ts",
      snippets: [snippet],
    })),
];

const toExtension = ({ extension }) => `.${extension}`;

const fileOf = (program, snippet) =>
  path.join(
    output,
    program.name,
    `${slug(path.relative(workspace, snippet.file))}_${snippet.line}${toExtension(snippet)}`,
  );

// A Solid example is compiled with Solid's JSX, whatever the program's default is.
const readPragmas = ({ owner }) => {
  if (owner === "@priemskiyyy/beacon-solid") {
    return ["/** @jsxImportSource solid-js */"];
  }

  return [];
};

const writeProgram = (program, imports) => {
  const folder = path.join(output, program.name);

  const augmented = readAugmented(
    [
      ambients[program.ambient],
      ...program.snippets.map(({ text }) => text),
    ].join("\n"),
  );

  mkdirSync(folder, { recursive: true });

  program.written = program.snippets.map((snippet) => {
    const header = [...readPragmas(snippet), ...(imports.get(snippet) ?? [])];

    const file = fileOf(program, snippet);

    // A file with no import or export is a script, and its names would be shared.
    writeFileSync(
      file,
      `${[...header, snippet.text].join("\n")}\nexport {};\n`,
    );

    return { file, snippet, header: header.length };
  });

  // An augmentation alone does not load the module it augments, so the program imports it.
  writeFileSync(
    path.join(folder, "augmented.ts"),
    `${augmented.map((name) => `import type {} from "${name}";`).join("\n")}\nexport {};\n`,
  );

  writeFileSync(
    path.join(folder, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: "../../../tsconfig.json",
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
          // A placeholder is `any`, and so is what it calls back with.
          noImplicitAny: false,
          // An example imports a name, whether it is a value or a type, as its reader would.
          verbatimModuleSyntax: false,
          types: ["node"],
          baseUrl: ".",
          paths,
        },
        // Wildcards skip dot directories such as .artifacts, so every file is named.
        include: [],
        files: [
          ...program.written.map(({ file }) => file),
          path.join(folder, "augmented.ts"),
          path.join(output, program.ambient),
        ],
      },
      null,
      2,
    )}\n`,
  );
};

const run = (program) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [typescript, "-p", path.join(output, program.name), "--pretty", "false"],
      { cwd: workspace },
    );

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("close", () => resolve(stdout));
  });

const DIAGNOSTIC = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/;

// A name the compiler cannot find, which is what an example leaves out.
const MISSING =
  /^(?:Cannot find (?:name|namespace)|No value exists in scope for the shorthand property) '([^']+)'/;

const compile = async (program) => {
  const out = await run(program);

  return out.split("\n").flatMap((line) => {
    const found = DIAGNOSTIC.exec(line);

    if (found === null) {
      return [];
    }

    const entry = program.written.find(
      ({ file }) => file === path.resolve(workspace, found[1]),
    );

    if (entry === undefined) {
      return [{ snippet: undefined, code: found[3], message: line }];
    }

    return [
      {
        snippet: entry.snippet,
        // The line of the source file the example's line sits on.
        at: entry.snippet.line + Number(found[2]) - entry.header,
        code: found[3],
        message: found[4],
        missing: MISSING.exec(found[4])?.[1] ?? null,
      },
    ];
  });
};

// First compile without imports, to learn which names each example leaves out.
await Promise.all(programs.map((program) => writeProgram(program, new Map())));

const first = (await Promise.all(programs.map(compile))).flat();

// The entry an example's name comes from: its own package's, else the core's, else the only other that exports it.
const toImport = (snippet, name) => {
  const others = [...exportsOf]
    .filter(([owner]) => owner !== snippet.owner && owner !== CORE)
    .flatMap(([, entries]) => entries.filter(({ names }) => names.has(name)));

  const found =
    findEntry(exportsOf.get(snippet.owner), name, snippet.file) ??
    findEntry(exportsOf.get(CORE), name, snippet.file) ??
    (others.length === 1 ? others[0] : undefined);

  if (found === undefined) {
    return null;
  }

  return { module: found.module, name };
};

const imports = new Map();

for (const { snippet, missing } of first) {
  const wanted =
    snippet === undefined || missing === null
      ? null
      : toImport(snippet, missing);

  if (wanted === null) {
    continue;
  }

  const held = imports.get(snippet) ?? [];

  if (!held.some((line) => line.includes(`{ ${wanted.name} }`))) {
    imports.set(snippet, [
      ...held,
      `import { ${wanted.name} } from "${wanted.module}";`,
    ]);
  }
}

await Promise.all(programs.map((program) => writeProgram(program, imports)));

const diagnostics = (await Promise.all(programs.map(compile))).flat();
const used = new Set();
const problems = [];

for (const { snippet, at, code, message, missing } of diagnostics) {
  if (snippet === undefined) {
    problems.push(message);
    continue;
  }

  if (missing !== null && PLACEHOLDERS.has(missing)) {
    used.add(missing);
    continue;
  }

  problems.push(
    `${path.relative(workspace, snippet.file)}:${at}: ${code}: ${message}`,
  );
}

for (const name of PLACEHOLDERS) {
  if (!used.has(name)) {
    problems.push(
      `${name} is listed as a placeholder and no example leaves it out.`,
    );
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(
  `Compiled ${snippets.length} JSDoc examples from ${new Set(snippets.map(({ file }) => file)).size} files in ${programs.length} programs.`,
);
