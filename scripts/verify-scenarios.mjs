import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";

// The specification's regression scenarios: 202 rows in 14 groups. A test is
// named after the row it proves, so the coverage below is read from the tests
// and never typed by hand. A rule only the compiler can prove is marked in its
// contract file with a line comment naming the row, right above the
// `@ts-expect-error` or `expectTypeOf` that proves it; a check no test can run
// is marked the same way above its assertion in a script.
const GROUPS = [
  ["CORE", "Core state and observations", 14],
  ["VER", "Identity, ordering, and revision", 18],
  ["HTTP", "HTTP, manifests, and shared feeds", 18],
  ["POL", "Support policy", 14],
  ["WEB", "Browser reload and deployment", 12],
  ["SW", "Service-worker and Workbox", 16],
  ["EXPO", "Expo Updates", 20],
  ["PLAY", "Google Play native flows", 18],
  ["STORE", "App Store metadata and handoff", 10],
  ["SAFE", "Disruption coordination", 14],
  ["JOURNAL", "Persistence and boot reconciliation", 14],
  ["LIFE", "Sessions and resource ownership", 12],
  ["SEC", "Security and diagnostics", 12],
  ["BIND", "Types, React, and SSR", 10],
];

const DOC = "docs/verification.md";
const START = "<!-- scenarios:start -->";
const END = "<!-- scenarios:end -->";

const findFiles = (directory, pattern) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist") {
      return [];
    }

    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findFiles(path, pattern);
    }

    return pattern.test(entry.name) ? [path] : [];
  });

const covered = new Map(GROUPS.map(([group]) => [group, new Set()]));

const record = (file, group, row) => {
  const known = GROUPS.find(([name]) => name === group);

  assert(known, `${file} names the unknown scenario group ${group}.`);
  assert(
    Number(row) >= 1 && Number(row) <= known[2],
    `${file} names ${group}-${row}, but ${group} has ${known[2]} rows.`,
  );
  covered.get(group).add(Number(row));
};

for (const file of findFiles("packages", /\.test\.tsx?$/)) {
  const source = readFileSync(file, "utf8");

  for (const [, group, row] of source.matchAll(/\btest\("([A-Z]+)-(\d+) /g)) {
    record(file, group, row);
  }
}

// A marker proves nothing unless the line it stands over does.
const markerFollowers = [
  [/\.contracts\.tsx?$/, /@ts-expect-error|expectTypeOf\(/],
  [/\.mjs$/, /assert/],
];

const markedFiles = [
  ...findFiles("packages", /\.contracts\.tsx?$/),
  ...findFiles("scripts", /\.mjs$/),
];

for (const file of markedFiles) {
  const [, follower] = markerFollowers.find(([pattern]) => pattern.test(file));
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    const marker = /^\s*\/\/ ([A-Z]+)-(\d+) /.exec(line);

    if (marker === null) {
      continue;
    }

    const rest = lines.slice(index + 1);

    const next = rest.find(
      (candidate) => !/^\s*\/\/ [A-Z]+-\d+ /.test(candidate),
    );

    assert(
      next !== undefined && follower.test(next),
      `${file}:${index + 1} marks ${marker[1]}-${marker[2]} above a line that proves nothing.`,
    );
    record(file, marker[1], marker[2]);
  }
}

const rows = GROUPS.map(([group, title, total]) => {
  const ids = [...covered.get(group)].sort((left, right) => left - right);
  const list = ids.map((id) => String(id).padStart(2, "0")).join(", ");

  return `| ${group} | ${title} | ${total} | ${ids.length} | ${list === "" ? "none" : list} |`;
});

const all = GROUPS.reduce((sum, [, , total]) => sum + total, 0);
const proven = [...covered.values()].reduce((sum, ids) => sum + ids.size, 0);

const table = [
  START,
  "| Group | Covers | Specified | Proven | Rows proven |",
  "| ----- | ------ | --------- | ------ | ----------- |",
  ...rows,
  `| Total | | ${all} | ${proven} | |`,
  END,
].join("\n");

const document = readFileSync(DOC, "utf8");
const from = document.indexOf(START);
const to = document.indexOf(END);

assert(from !== -1 && to !== -1, `${DOC} needs the scenario table markers.`);

// Prettier aligns the table, so the comparison is against what it writes.
const next = await format(
  document.slice(0, from) + table + document.slice(to + END.length),
  { ...(await resolveConfig(DOC)), parser: "markdown" },
);

if (process.argv.includes("--write")) {
  writeFileSync(DOC, next);
  console.log(`Wrote ${proven} of ${all} scenarios to ${DOC}.`);
} else {
  assert.equal(
    document,
    next,
    `${DOC} is out of date with the tests. Run node scripts/verify-scenarios.mjs --write.`,
  );
  console.log(`Verified ${proven} of ${all} scenarios against ${DOC}.`);
}
