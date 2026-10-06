// The rules a release must keep, as functions of the package manifests, the
// changelog and the tag, so that the script that gates a publish and the test of
// that script read the same code.
export const REPOSITORY = "priemskiyyy/beacon";

export const HOMEPAGE = "https://priemskiyyy.github.io/beacon/";

const VERSION = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The package name without its scope, which is what a release tag spells. */
export const shortName = (name) => name.split("/").at(-1);

/** The release tag of a package version: `beacon-expo-v0.1.0`. */
export const tagOf = (name, version) => `${shortName(name)}-v${version}`;

const VERSION_TAIL = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;

/**
 * The package a tag names: the one whose name, `-v` and a semantic version spell the whole
 * tag, the longest name first, so a package whose name ends in `-v2` is not mistaken for
 * the shorter name and a version. A tag that spells no package gives `undefined`.
 */
export const readTagPackage = (tag, names) =>
  [...names]
    .sort((left, right) => shortName(right).length - shortName(left).length)
    .find((name) => {
      const prefix = `${shortName(name)}-v`;

      return (
        tag.startsWith(prefix) && VERSION_TAIL.test(tag.slice(prefix.length))
      );
    });

/**
 * The peer range every Beacon package declares on another: the shared line. For a 0.x
 * version it is the minor (`^0.1.0` already means `>=0.1.0 <0.2.0`, but a range spelled
 * out cannot be misread), and for a prerelease the floor is the prerelease itself, since
 * `0.2.0-next.1` is below `0.2.0`.
 */
export const peerRangeOf = (version) => {
  const [core, prerelease] = version.split(/-(.*)/s);
  const [major, minor] = core.split(".").map(Number);
  const suffix = prerelease === undefined ? "" : "-0";

  if (major === 0) {
    return `>=0.${minor}.0${suffix} <0.${minor + 1}`;
  }

  return `>=${major}.0.0${suffix} <${major + 1}`;
};

/** The changelog's headings: `## <package> <version> - <date or Unreleased>`. */
export const readChangelog = (text) =>
  text.split("\n").flatMap((line) => {
    const match = /^## (\S+) (\S+) - (.+)$/.exec(line);

    if (match === null) {
      return [];
    }

    return [{ name: match[1], version: match[2], when: match[3].trim() }];
  });

const isCalendarDate = (text) => {
  const match = DATE.exec(text);

  if (match === null) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const metadataProblems = ({ name, directory, manifest }) => {
  const problems = [];

  const expect = (condition, message) => {
    if (!condition) {
      problems.push(`${name}: ${message}`);
    }
  };

  expect(
    manifest.license === "MIT",
    `license is ${manifest.license}, not MIT.`,
  );
  expect(
    manifest.private !== true,
    "the package is private, so it cannot be published.",
  );
  expect(
    manifest.type === "module",
    'it is ESM only and must say "type": "module".',
  );
  expect(manifest.sideEffects === false, 'it must say "sideEffects": false.');
  expect(
    manifest.publishConfig?.access === "public",
    'publishConfig.access must be "public": a scoped package is private by default.',
  );
  expect(
    manifest.repository?.url === `git+https://github.com/${REPOSITORY}.git`,
    `repository.url is ${manifest.repository?.url}.`,
  );
  expect(
    manifest.repository?.directory === directory,
    `repository.directory is ${manifest.repository?.directory}, not ${directory}.`,
  );
  expect(
    manifest.bugs?.url === `https://github.com/${REPOSITORY}/issues`,
    `bugs.url is ${manifest.bugs?.url}.`,
  );
  expect(manifest.homepage === HOMEPAGE, `homepage is ${manifest.homepage}.`);
  expect(
    typeof manifest.description === "string" && manifest.description.length > 0,
    "it has no description.",
  );
  expect(
    Array.isArray(manifest.files) &&
      ["dist", "README.md", "LICENSE"].every((entry) =>
        manifest.files.includes(entry),
      ),
    "files must list dist, README.md and LICENSE.",
  );
  expect(
    VERSION.test(manifest.version),
    `version ${manifest.version} is not semver.`,
  );

  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      expect(
        !String(range).startsWith("workspace:"),
        `${field} names ${dependency} as ${range}.`,
      );
    }
  }

  expect(
    Object.keys(manifest.dependencies ?? {}).length === 0,
    "it has runtime dependencies: an SDK is the application's, and the core has none.",
  );

  return problems;
};

/**
 * Everything wrong with a release, as a list of sentences; empty when it can go out.
 *
 * `packages` is `[{ name, directory, manifest }]`, `changelog` the text of CHANGELOG.md,
 * `tag` and `prerelease` what GitHub's release event says (both undefined for a local
 * run), and `requested` the package names to check (every package when empty).
 */
export const checkRelease = ({
  packages,
  changelog,
  tag,
  prerelease,
  requested = [],
}) => {
  const problems = [];
  const names = packages.map((entry) => entry.name);
  const selected = [...requested];

  if (tag !== undefined) {
    const fromTag = readTagPackage(tag, names);

    if (fromTag === undefined) {
      return {
        problems: [
          `The tag ${tag} names no package of this repository, or names no version of one.`,
        ],
        released: [],
      };
    }

    selected.push(fromTag);
  }

  for (const name of selected) {
    if (!names.includes(name)) {
      return { problems: [`Unknown release package: ${name}.`], released: [] };
    }
  }

  const targets = packages.filter(
    (entry) => selected.length === 0 || selected.includes(entry.name),
  );

  // One version line: a package on another version is a package nobody released with the rest.
  const versions = new Set(packages.map((entry) => entry.manifest.version));

  if (versions.size !== 1) {
    problems.push(
      `The packages do not share one version line: ${packages
        .map((entry) => `${entry.name} ${entry.manifest.version}`)
        .join(", ")}.`,
    );
  }

  const [line] = [...versions];
  const entries = readChangelog(changelog);

  for (const name of new Set(entries.map((entry) => entry.name))) {
    if (!names.includes(name)) {
      problems.push(`The changelog names ${name}, which is not a package.`);
    }
  }

  for (const entry of targets) {
    const { name, manifest } = entry;
    const { version } = manifest;

    problems.push(...metadataProblems(entry));

    // Peers on the line: a minor bump of the core strands every dependent that kept the old range.
    for (const [dependency, range] of Object.entries(
      manifest.peerDependencies ?? {},
    )) {
      if (names.includes(dependency) && range !== peerRangeOf(version)) {
        problems.push(
          `${name}: the peer ${dependency} is ${range}, and the line ${version} needs ${peerRangeOf(version)}.`,
        );
      }
    }

    const heading = entries.find(
      (candidate) => candidate.name === name && candidate.version === version,
    );

    if (heading === undefined) {
      problems.push(`${name} ${version} needs a changelog entry.`);
    } else if (tag !== undefined && !isCalendarDate(heading.when)) {
      // `Unreleased`, or anything else that is not a date, blocks the publish rather than shipping a version nobody dated.
      problems.push(
        `${name} ${version}: the changelog heading says "${heading.when}", and a release needs its date as YYYY-MM-DD.`,
      );
    }

    if (tag !== undefined && tag !== tagOf(name, version)) {
      problems.push(
        `The tag ${tag} does not match ${name} ${version}, which is ${tagOf(name, version)}.`,
      );
    }

    if (
      prerelease !== undefined &&
      prerelease !== String(version.includes("-"))
    ) {
      problems.push(
        `${name} ${version}: the GitHub prerelease flag is ${prerelease}, and the version says ${version.includes("-")}.`,
      );
    }
  }

  return {
    problems,
    line,
    released: targets.map((entry) => ({
      name: entry.name,
      version: entry.manifest.version,
      distTag: entry.manifest.version.includes("-") ? "next" : "latest",
    })),
  };
};
