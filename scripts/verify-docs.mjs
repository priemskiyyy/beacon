import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("..", import.meta.url));
const docs = path.join(workspace, "docs");

// The build output and cache of VitePress are not pages.
const listPages = (directory) =>
  readdirSync(directory, { recursive: true })
    .filter((name) => name.endsWith(".md") && !name.startsWith(".vitepress"))
    .map((name) => path.join(directory, name));

// A folder of packages or examples may not exist yet, and one without a README is not prose.
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

// The id VitePress gives a heading, so a link to `page.md#heading` can be checked.
const slugify = (text) =>
  text
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .replaceAll(/\p{Cc}/gu, "")
    .replaceAll(
      /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'\u201C\u201D\u2018\u2019<>,.?/]+/g,
      "-",
    )
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .replace(/^(\d)/, "_$1")
    .toLowerCase();

const listAnchors = (file) => {
  const inFence = { open: false };

  return new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line) => {
        if (line.startsWith("```")) {
          inFence.open = !inFence.open;

          return [];
        }

        const heading = /^#{1,6} (.+)$/.exec(line);

        if (inFence.open || heading === null) {
          return [];
        }

        // The text a reader sees: no code marks, no link targets.
        const text = heading[1]
          .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replaceAll(/[`*]/g, "");

        return [slugify(text)];
      }),
  );
};

const pages = listPages(docs);

const prose = [
  ...pages,
  ...[
    "README.md",
    "CONTRIBUTING.md",
    "RELEASING.md",
    "SUPPORT.md",
    "SECURITY.md",
    "CHANGELOG.md",
  ].map((file) => path.join(workspace, file)),
  ...listReadmes("packages"),
  ...listReadmes("packages/adapters"),
  ...listReadmes("examples"),
];

const failures = [];

for (const page of pages) {
  const text = readFileSync(page, "utf8");
  const name = path.relative(workspace, page);

  if (!/^---\ndescription: "[^"\n]+"\n---\n/.test(text)) {
    failures.push(`${name} needs a frontmatter description.`);
  }

  const headings = text.split("\n").filter((line) => line.startsWith("# "));

  if (headings.length !== 1) {
    failures.push(`${name} needs exactly one h1, not ${headings.length}.`);
  }
}

for (const file of prose) {
  const text = readFileSync(file, "utf8");
  const name = path.relative(workspace, file);

  // The code point, so the rule cannot be dodged by how the file is viewed.
  if (text.includes(String.fromCodePoint(0x2014))) {
    failures.push(`${name} contains an em dash.`);
  }

  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) {
      continue;
    }

    const [relative, fragment] = target.split("#");

    const resolved =
      relative === "" ? file : path.resolve(path.dirname(file), relative);

    if (!existsSync(resolved)) {
      failures.push(`${name} links to ${target}, which does not exist.`);
      continue;
    }

    if (fragment === undefined || !resolved.endsWith(".md")) {
      continue;
    }

    if (!listAnchors(resolved).has(fragment)) {
      failures.push(`${name} links to ${target}, which has no such heading.`);
    }
  }
}

// A getting started page shows the files of its minimal example as they are: the last fence of the page that names a file under `src` is that file of the example, so the page and the app that is compiled, bundled and run cannot drift. A fence of a file the example does not have is not compared.
const GUIDES = [
  { page: "docs/react-native.md", example: "examples/expo" },
  { page: "docs/getting-started.md", example: "examples/react-minimal" },
];

for (const { page, example } of GUIDES) {
  const shown = new Map(
    [
      ...readFileSync(path.join(workspace, page), "utf8").matchAll(
        /^```(?:ts|tsx)\n\/\/ src\/(\S+)\n([\s\S]*?)\n```$/gm,
      ),
    ].map(([, name, body]) => [name, body]),
  );

  for (const [name, body] of shown) {
    const file = path.join(workspace, example, "src", name);

    if (existsSync(file) && readFileSync(file, "utf8").trimEnd() !== body) {
      failures.push(`${page} shows src/${name} differently from ${example}.`);
    }
  }
}

// api.md lists every name the entry points of the documented packages export.
const listAdapterEntries = () =>
  readdirSync(path.join(workspace, "packages/adapters"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => `packages/adapters/${entry.name}/src/index.ts`);

const entries = [
  "packages/core/src/index.ts",
  "packages/core/src/adapter.ts",
  "packages/core/src/mock.ts",
  "packages/core/src/testing.ts",
  "packages/core/src/triggers.ts",
  "packages/core/src/triggers/browser.ts",
  "packages/core/src/versions.ts",
  "packages/react/src/index.ts",
  "packages/vue/src/index.ts",
  "packages/solid/src/index.ts",
  "packages/svelte/src/index.ts",
  "packages/devtools/src/index.ts",
  "packages/devtools/src/react.ts",
  "packages/adapters/expo/src/mock.ts",
  ...listAdapterEntries(),
];

const api = readFileSync(path.join(docs, "api.md"), "utf8");

// The text under each `## @scope/name` heading, so an export must be listed in the section of its own entry point.
const sections = new Map(
  api
    .split(/^## /m)
    .slice(1)
    .map((section) => [section.split("\n")[0].trim(), section]),
);

const readPackageName = (entry) => {
  const source = entry.slice(0, entry.indexOf("/src/") + "/src".length);

  return JSON.parse(
    readFileSync(
      path.join(workspace, path.dirname(source), "package.json"),
      "utf8",
    ),
  ).name;
};

// A subpath is named by where its entry sits under `src`: `mock` for `src/mock.ts`, `triggers/browser` for `src/triggers/browser.ts`.
const readSectionTitle = (entry) => {
  const source = entry.slice(0, entry.indexOf("/src/") + "/src".length);
  const name = readPackageName(entry);

  const subpath = entry.slice(source.length + 1, -".ts".length);

  if (subpath === "index") {
    return name;
  }

  return `${name}/${subpath}`;
};

const exported = [];

// The root, the adapter and the versions entries split one vocabulary of the core, so a name has one home among them and an import path never has two meanings. Other entries may repeat a name on purpose (`foreground` of the browser triggers, the devtools' props).
const SPLIT = [
  "packages/core/src/index.ts",
  "packages/core/src/adapter.ts",
  "packages/core/src/versions.ts",
];

const homes = new Map();

for (const entry of entries) {
  const source = readFileSync(path.join(workspace, entry), "utf8");
  const title = readSectionTitle(entry);
  const section = sections.get(title);

  if (section === undefined) {
    failures.push(`docs/api.md has no section "${title}" for ${entry}.`);
    continue;
  }

  for (const [, list] of source.matchAll(/export (?:type )?\{([^}]*)\}/g)) {
    for (const piece of list.split(",")) {
      // The public name of `default as Name` is Name, as the Svelte component is exported.
      const name = piece
        .trim()
        .split(/\s+as\s+/)
        .at(-1);

      if (name === "") {
        continue;
      }

      exported.push(name);

      if (SPLIT.includes(entry)) {
        if (homes.has(name)) {
          failures.push(
            `${name} is exported by both ${homes.get(name)} and ${entry}.`,
          );
        }

        homes.set(name, entry);
      }

      if (!section.includes(`\`${name}\``)) {
        failures.push(`docs/api.md does not list ${name} under "${title}".`);
      }
    }
  }
}

assert.deepEqual(
  failures,
  [],
  `Documentation problems:\n${failures.join("\n")}`,
);
console.log(
  `Verified ${pages.length} pages, ${prose.length} prose files and ${exported.length} exports.`,
);
