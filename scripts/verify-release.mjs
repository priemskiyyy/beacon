import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

import { listPackages, workspace } from "./packWorkspace.mjs";
import { checkRelease } from "./releaseRules.mjs";

// Run with no arguments, it checks every package against the shared version line
// and the changelog. Run by the publish workflow, `RELEASE_TAG` names the package
// being released (`beacon-expo-v0.1.0`), and the changelog must date its entry.
// Names after the script select packages.
const packages = listPackages().map((entry) => ({
  name: entry.manifest.name,
  directory: entry.directory,
  manifest: entry.manifest,
}));

const { problems, released } = checkRelease({
  packages,
  changelog: readFileSync(path.join(workspace, "CHANGELOG.md"), "utf8"),
  tag: process.env.RELEASE_TAG,
  prerelease: process.env.RELEASE_PRERELEASE,
  requested: process.argv.slice(2),
});

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }

  console.error(`\n${problems.length} problem(s) stop this release.`);
  process.exit(1);
}

for (const { name, version, distTag } of released) {
  console.log(`Release metadata is valid for ${name} ${version} (${distTag}).`);
}

if (
  process.env.GITHUB_OUTPUT !== undefined &&
  process.env.RELEASE_TAG !== undefined
) {
  const [{ name, version, distTag }] = released;

  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `package=${name}\nversion=${version}\ndist-tag=${distTag}\n`,
  );
}
