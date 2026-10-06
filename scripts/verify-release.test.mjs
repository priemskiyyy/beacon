import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { listPackages, workspace } from "./packWorkspace.mjs";
import {
  checkRelease,
  peerRangeOf,
  readChangelog,
  readTagPackage,
  tagOf,
} from "./releaseRules.mjs";

// Run with `pnpm test:release`. Each case breaks one rule of a release and says
// which sentence must name it, so the script that gates a publish is itself gated.
const make = (name, directory, overrides = {}) => ({
  name,
  directory,
  manifest: {
    name,
    version: "0.1.0",
    description: "A package.",
    type: "module",
    license: "MIT",
    sideEffects: false,
    repository: {
      type: "git",
      url: "git+https://github.com/priemskiyyy/beacon.git",
      directory,
    },
    bugs: { url: "https://github.com/priemskiyyy/beacon/issues" },
    homepage: "https://priemskiyyy.github.io/beacon/",
    publishConfig: { access: "public" },
    files: ["dist", "README.md", "LICENSE"],
    peerDependencies:
      name === "@priemskiyyy/beacon"
        ? {}
        : { "@priemskiyyy/beacon": ">=0.1.0 <0.2" },
    ...overrides,
  },
});

const packages = () => [
  make("@priemskiyyy/beacon", "packages/core"),
  make("@priemskiyyy/beacon-react", "packages/react"),
  make("@priemskiyyy/beacon-expo", "packages/adapters/expo"),
  make("@priemskiyyy/beacon-v2", "packages/adapters/v2"),
];

const changelog = (when = "2026-10-01") =>
  [
    "# Changelog",
    ...packages().map((entry) => `## ${entry.name} 0.1.0 - ${when}`),
    "- First release.",
  ].join("\n");

const problemsOf = (options) =>
  checkRelease({ packages: packages(), changelog: changelog(), ...options })
    .problems;

test("a consistent set of packages can be released", () => {
  assert.deepEqual(problemsOf({}), []);
  assert.deepEqual(
    problemsOf({ tag: "beacon-expo-v0.1.0", prerelease: "false" }),
    [],
  );
});

test("a tag names the package without its scope, and the version", () => {
  assert.equal(
    tagOf("@priemskiyyy/beacon-expo", "0.1.0"),
    "beacon-expo-v0.1.0",
  );

  const names = packages().map((entry) => entry.name);

  assert.equal(readTagPackage("beacon-v0.1.0", names), "@priemskiyyy/beacon");
  assert.equal(
    readTagPackage("beacon-react-v0.1.0-next.1", names),
    "@priemskiyyy/beacon-react",
  );
  // A package whose name ends in -v2 is not a version.
  assert.equal(
    readTagPackage("beacon-v2-v0.1.0", names),
    "@priemskiyyy/beacon-v2",
  );
  assert.equal(readTagPackage("beacon-native-v0.1.0", names), undefined);
});

test("a tag that matches no package is refused", () => {
  const { problems, released } = checkRelease({
    packages: packages(),
    changelog: changelog(),
    tag: "beacon-native-v0.1.0",
  });

  assert.match(problems.join("\n"), /beacon-native-v0\.1\.0 names no package/);
  assert.deepEqual(released, []);
});

test("a tag of another version than the package is refused", () => {
  assert.match(
    problemsOf({ tag: "beacon-v0.1.1" }).join("\n"),
    /does not match @priemskiyyy\/beacon 0\.1\.0, which is beacon-v0\.1\.0/,
  );
  assert.match(
    problemsOf({ tag: "beacon-v0.1.0-v0.1.0" }).join("\n"),
    /does not match/,
  );
});

test("a stable tag needs a dated changelog entry, and Unreleased blocks it", () => {
  const options = { tag: "beacon-v0.1.0", prerelease: "false" };

  assert.match(
    checkRelease({
      packages: packages(),
      changelog: changelog("Unreleased"),
      ...options,
    }).problems.join("\n"),
    /needs its date as YYYY-MM-DD/,
  );
  assert.match(
    checkRelease({
      packages: packages(),
      changelog: changelog("2026-02-30"),
      ...options,
    }).problems.join("\n"),
    /needs its date/,
  );
  // With no tag it is a local run, and an undated entry is still a draft.
  assert.deepEqual(
    checkRelease({ packages: packages(), changelog: changelog("Unreleased") })
      .problems,
    [],
  );
});

test("a version with no changelog entry is refused", () => {
  const text = changelog().replace(
    "## @priemskiyyy/beacon-react 0.1.0",
    "## @priemskiyyy/beacon-react 0.0.9",
  );

  assert.match(
    checkRelease({ packages: packages(), changelog: text }).problems.join("\n"),
    /@priemskiyyy\/beacon-react 0\.1\.0 needs a changelog entry/,
  );
});

test("the changelog names no package that is gone", () => {
  const text = `${changelog()}\n## @priemskiyyy/beacon-native 0.1.0 - 2026-10-01\n`;

  assert.match(
    checkRelease({ packages: packages(), changelog: text }).problems.join("\n"),
    /names @priemskiyyy\/beacon-native, which is not a package/,
  );
});

test("a prerelease goes to next, a stable release to latest, and the flag must agree", () => {
  const next = packages().map((entry) => ({
    ...entry,
    manifest: {
      ...entry.manifest,
      version: "0.2.0-next.1",
      peerDependencies:
        entry.name === "@priemskiyyy/beacon"
          ? {}
          : { "@priemskiyyy/beacon": ">=0.2.0-0 <0.3" },
    },
  }));

  const text = packages()
    .map((entry) => `## ${entry.name} 0.2.0-next.1 - 2026-10-01`)
    .join("\n");

  const good = checkRelease({
    packages: next,
    changelog: text,
    tag: "beacon-v0.2.0-next.1",
    prerelease: "true",
  });

  assert.deepEqual(good.problems, []);
  assert.deepEqual(good.released, [
    { name: "@priemskiyyy/beacon", version: "0.2.0-next.1", distTag: "next" },
  ]);
  assert.match(
    checkRelease({
      packages: next,
      changelog: text,
      tag: "beacon-v0.2.0-next.1",
      prerelease: "false",
    }).problems.join("\n"),
    /prerelease flag is false/,
  );
  assert.equal(
    problemsOf({ tag: "beacon-v0.1.0", prerelease: "false" }).length,
    0,
  );
  assert.equal(
    checkRelease({
      packages: packages(),
      changelog: changelog(),
      tag: "beacon-v0.1.0",
      prerelease: "false",
    }).released[0].distTag,
    "latest",
  );
  assert.match(
    problemsOf({ tag: "beacon-v0.1.0", prerelease: "true" }).join("\n"),
    /prerelease flag is true/,
  );
});

test("the packages share one version line", () => {
  const split = packages();

  split[1].manifest.version = "0.1.1";
  assert.match(
    checkRelease({ packages: split, changelog: changelog() }).problems.join(
      "\n",
    ),
    /do not share one version line/,
  );
});

test("a peer on a Beacon package is the minor of the line", () => {
  assert.equal(peerRangeOf("0.1.0"), ">=0.1.0 <0.2");
  assert.equal(peerRangeOf("0.1.7"), ">=0.1.0 <0.2");
  assert.equal(peerRangeOf("0.2.0-next.1"), ">=0.2.0-0 <0.3");
  assert.equal(peerRangeOf("1.4.2"), ">=1.0.0 <2");

  const stale = packages();

  stale[1].manifest.peerDependencies = { "@priemskiyyy/beacon": "^0.0.9" };
  assert.match(
    checkRelease({ packages: stale, changelog: changelog() }).problems.join(
      "\n",
    ),
    /the peer @priemskiyyy\/beacon is \^0\.0\.9, and the line 0\.1\.0 needs >=0\.1\.0 <0\.2/,
  );
});

test("a manifest carries what the registry page and the install need", () => {
  const cases = [
    [{ license: "ISC" }, /license is ISC/],
    [{ private: true }, /private/],
    [{ type: undefined }, /type": "module/],
    [{ sideEffects: undefined }, /sideEffects/],
    [{ publishConfig: undefined }, /publishConfig\.access/],
    [{ homepage: undefined }, /homepage/],
    [{ bugs: { url: "https://example.com" } }, /bugs\.url/],
    [{ files: ["dist"] }, /files must list/],
    [{ dependencies: { semver: "7.0.0" } }, /runtime dependencies/],
    [
      { peerDependencies: { "@priemskiyyy/beacon": "workspace:*" } },
      /workspace:/,
    ],
    [
      {
        repository: {
          type: "git",
          url: "git+https://github.com/priemskiyyy/beacon.git",
          directory: "packages/elsewhere",
        },
      },
      /repository\.directory/,
    ],
  ];

  for (const [override, pattern] of cases) {
    const broken = packages();

    broken[2] = make(
      "@priemskiyyy/beacon-expo",
      "packages/adapters/expo",
      override,
    );
    assert.match(
      checkRelease({ packages: broken, changelog: changelog() }).problems.join(
        "\n",
      ),
      pattern,
    );
  }
});

test("the changelog reads one heading per package and version", () => {
  assert.deepEqual(
    readChangelog(
      "# Changelog\n\n## @s/a 0.1.0 - Unreleased\n- x\n## @s/b 1.0.0 - 2026-01-02\n",
    ),
    [
      { name: "@s/a", version: "0.1.0", when: "Unreleased" },
      { name: "@s/b", version: "1.0.0", when: "2026-01-02" },
    ],
  );
});

test("this repository's own packages pass every rule but the date of an unreleased entry", () => {
  const real = listPackages().map((entry) => ({
    name: entry.manifest.name,
    directory: entry.directory,
    manifest: entry.manifest,
  }));

  const { problems, released } = checkRelease({
    packages: real,
    changelog: readFileSync(path.join(workspace, "CHANGELOG.md"), "utf8"),
  });

  assert.deepEqual(problems, []);
  assert.equal(released.length, 15);
});
