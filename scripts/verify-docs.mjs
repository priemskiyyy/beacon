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
    if (/^(https?:|mailto:|#)/.test(target)) {
      continue;
    }

    const [relative] = target.split("#");
    const resolved = path.resolve(path.dirname(file), relative);

    if (!existsSync(resolved)) {
      failures.push(`${name} links to ${target}, which does not exist.`);
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
  "packages/core/src/mock.ts",
  "packages/core/src/testing.ts",
  "packages/core/src/versions.ts",
  "packages/react/src/index.ts",
  ...listAdapterEntries(),
];

const api = readFileSync(path.join(docs, "api.md"), "utf8");
const exported = new Set();

for (const entry of entries) {
  const source = readFileSync(path.join(workspace, entry), "utf8");

  for (const [, list] of source.matchAll(/export (?:type )?\{([^}]*)\}/g)) {
    for (const piece of list.split(",")) {
      const name = piece.trim();

      if (name !== "") {
        exported.add(name);
      }
    }
  }
}

for (const name of exported) {
  if (!api.includes(`\`${name}\``)) {
    failures.push(`docs/api.md does not list the export ${name}.`);
  }
}

assert.deepEqual(
  failures,
  [],
  `Documentation problems:\n${failures.join("\n")}`,
);
console.log(
  `Verified ${pages.length} pages, ${prose.length} prose files and ${exported.size} exports.`,
);
