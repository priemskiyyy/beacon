import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Every ts and tsx fence a reader could copy compiles against the built
// declarations of the workspace packages, as an installed package would
// provide them. Run `pnpm build` first.
//
// - A fence preceded by `<!-- snippet: fragment -->` is an excerpt and is skipped.
// - A fence whose first line is a file name comment, such as `// src/beacon.ts`,
//   is written under that name, so a later fence of the same page can import it.
// - Fences share one program, except those of a page that names a file or
//   augments a module: `Register` and a named file are global to a program, so
//   such a page gets a program of its own.
// - Names an application would declare and the page does not are in
//   `snippets.ambient.d.ts`. Below its `snippets: readme-only` line are the
//   names the package READMEs use without declaring or importing, and only the
//   READMEs see them, so a page of the documentation cannot lean on them.
const workspace = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(workspace, ".artifacts/snippets");
const ambientText = readFileSync(
  path.join(workspace, "scripts/snippets.ambient.d.ts"),
  "utf8",
);

const READMES_ONLY = "// snippets: readme-only";
const typescript = path.join(workspace, "node_modules/typescript/bin/tsc");

const listMarkdown = (directory) =>
  readdirSync(directory, { recursive: true })
    .filter((name) => name.endsWith(".md") && !name.startsWith(".vitepress"))
    .map((name) => path.join(directory, name));

const listReadmes = (directory) => {
  const parent = path.join(workspace, directory);

  if (!existsSync(parent)) {
    return [];
  }

  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => path.join(parent, entry.name, "README.md"))
    .filter((file) => existsSync(file));
};

const pages = [
  path.join(workspace, "README.md"),
  ...listReadmes("packages"),
  ...listReadmes("packages/adapters"),
  ...listReadmes("examples"),
  ...listMarkdown(path.join(workspace, "docs")),
];

// The published names of the workspace packages, each mapped to its built declarations.
const listPackageFolders = (directory) => {
  const parent = path.join(workspace, directory);

  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => path.join(parent, entry.name))
    .filter((folder) => existsSync(path.join(folder, "package.json")));
};

const readDeclarations = (folder) => {
  const manifest = JSON.parse(
    readFileSync(path.join(folder, "package.json"), "utf8"),
  );

  return Object.entries(manifest.exports ?? {}).flatMap(([subpath, target]) => {
    if (typeof target !== "object" || typeof target.types !== "string") {
      return [];
    }

    const file = path.resolve(folder, target.types);

    if (!existsSync(file)) {
      return [];
    }

    return [[`${manifest.name}${subpath.slice(1)}`, [file]]];
  });
};

const paths = Object.fromEntries([
  ...listPackageFolders("packages").flatMap(readDeclarations),
  ...listPackageFolders("packages/adapters").flatMap(readDeclarations),
  ["src/*", ["./src/*"]],
]);

if (paths["@priemskiyyy/beacon"] === undefined) {
  console.error(
    "The core is not built: run `pnpm build` first, so the snippets compile against its declarations.",
  );
  process.exit(1);
}

// Solid compiles its own JSX, so a Solid page needs settings of its own.
const compilerOptionsFor = (page) => {
  if (
    /^(packages\/solid\/|docs\/solid\.md$|examples\/solid)/.test(
      path.relative(workspace, page),
    )
  ) {
    return { jsx: "preserve", jsxImportSource: "solid-js" };
  }

  return {};
};

const slug = (text) => text.replaceAll(/[^A-Za-z0-9]+/g, "_");

const readFences = (page) => {
  const lines = readFileSync(page, "utf8").split("\n");

  return lines.flatMap((line, index) => {
    const fence = /^```(ts|tsx)$/.exec(line);

    if (fence === null) {
      return [];
    }

    const marker = lines
      .slice(0, index)
      .findLast((candidate) => candidate.trim() !== "");

    if (marker?.trim() === "<!-- snippet: fragment -->") {
      return [];
    }

    const end = lines.findIndex(
      (candidate, at) => at > index && candidate === "```",
    );

    if (end === -1) {
      throw new Error(
        `${path.relative(workspace, page)}:${index + 1} opens a fence that never closes.`,
      );
    }

    const body = lines.slice(index + 1, end);
    const named = /^\/\/ ((?:src\/)?[\w./-]+\.tsx?)$/.exec(body[0] ?? "");

    return [
      {
        page,
        line: index + 1,
        extension: fence[1],
        file: named === null ? null : named[1],
        text: body.join("\n"),
      },
    ];
  });
};

const fences = pages.flatMap(readFences);

// A page with a named file or an augmentation runs alone; the rest share one program.
const isolated = new Set(
  fences
    .filter(
      (fence) =>
        fence.file !== null ||
        /\bdeclare module\b/.test(fence.text) ||
        Object.keys(compilerOptionsFor(fence.page)).length > 0,
    )
    .map((fence) => fence.page),
);

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

writeFileSync(
  path.join(output, "ambient.docs.d.ts"),
  ambientText.slice(0, ambientText.indexOf(READMES_ONLY)),
);
writeFileSync(path.join(output, "ambient.readme.d.ts"), ambientText);

const isReadme = (page) => path.basename(page) === "README.md";

const programs = new Map();

for (const fence of fences) {
  let name = "docs";

  if (isolated.has(fence.page)) {
    name = slug(path.relative(workspace, fence.page));
  } else if (isReadme(fence.page)) {
    name = "readmes";
  }

  const folder = path.join(output, name);
  const file = path.join(
    folder,
    fence.file ??
      `${slug(path.relative(workspace, fence.page))}_${fence.line}.${fence.extension}`,
  );

  mkdirSync(path.dirname(file), { recursive: true });
  // A file with no import or export is a script, and its names would be shared.
  writeFileSync(file, `${fence.text}\nexport {};\n`);

  const program = programs.get(name) ?? {
    folder,
    options: compilerOptionsFor(fence.page),
    ambient: path.join(
      output,
      isReadme(fence.page) ? "ambient.readme.d.ts" : "ambient.docs.d.ts",
    ),
    files: [],
  };

  program.files.push({ file, fence });
  programs.set(name, program);
}

// An augmentation alone does not load the module it augments, so the program imports it.
const readAugmented = (files) => [
  ...new Set(
    files.flatMap(({ fence }) =>
      [...fence.text.matchAll(/\bdeclare module "([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ),
];

for (const { folder, options, ambient, files } of programs.values()) {
  const augmented = path.join(folder, "augmented.ts");

  writeFileSync(
    augmented,
    `${readAugmented(files)
      .map((name) => `import type {} from "${name}";`)
      .join("\n")}\nexport {};\n`,
  );

  writeFileSync(
    path.join(folder, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: "../../../tsconfig.json",
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
          types: ["node"],
          baseUrl: ".",
          paths,
          ...options,
        },
        // Wildcards skip dot directories such as .artifacts, so every file is named.
        include: [],
        files: [...files.map(({ file }) => file), augmented, ambient],
      },
      null,
      2,
    )}\n`,
  );
}

const compile = (program) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [typescript, "-p", program.folder, "--pretty", "false"],
      { cwd: workspace },
    );

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("close", (status) => resolve({ program, status, stdout }));
  });

const results = await Promise.all([...programs.values()].map(compile));

// Map each error back to the page and line its fence came from.
const locate = (line, program) => {
  const match = /^(.+?)\((\d+),\d+\): (.*)$/.exec(line);

  if (match === null) {
    return line;
  }

  const found = program.files.find(
    ({ file }) => path.resolve(workspace, match[1]) === file,
  );

  if (found === undefined) {
    return line;
  }

  const { page, line: fenceLine } = found.fence;

  return `${path.relative(workspace, page)}:${fenceLine + Number(match[2])}: ${match[3]}`;
};

const failed = results.filter(({ status }) => status !== 0);

for (const { program, stdout } of failed) {
  for (const line of stdout.split("\n")) {
    if (line.trim() !== "") {
      console.error(locate(line, program));
    }
  }
}

if (failed.length > 0) {
  process.exit(1);
}

console.log(
  `Compiled ${fences.length} snippets from ${pages.length} pages in ${programs.size} programs.`,
);
