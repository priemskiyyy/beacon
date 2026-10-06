import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { listPackages, workspace } from "./packWorkspace.mjs";
import { peerRangeOf } from "./releaseRules.mjs";

// Moves every package to one version and every peer on another Beacon package to
// that version's line, in one step, since one without the other leaves a package
// that cannot be installed beside its core.
//
//   pnpm release:version 0.2.0
//   pnpm release:version 0.2.0-next.1
const [version] = process.argv.slice(2);

if (version === undefined || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
  console.error("Usage: pnpm release:version <major.minor.patch[-prerelease]>");
  process.exit(1);
}

const packages = listPackages();
const names = new Set(packages.map((entry) => entry.manifest.name));

for (const { folder, manifest } of packages) {
  manifest.version = version;

  for (const dependency of Object.keys(manifest.peerDependencies ?? {})) {
    if (names.has(dependency)) {
      manifest.peerDependencies[dependency] = peerRangeOf(version);
    }
  }

  writeFileSync(
    path.join(folder, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

const changelog = readFileSync(path.join(workspace, "CHANGELOG.md"), "utf8");

const missing = [...names].filter(
  (name) => !changelog.includes(`## ${name} ${version} - `),
);

console.log(
  `Moved ${packages.length} packages to ${version}, with their peers on ${peerRangeOf(version)}.`,
);

if (missing.length > 0) {
  console.log(
    `CHANGELOG.md still needs a "## <package> ${version} - <date>" heading for:\n${missing.map((name) => `  ${name}`).join("\n")}`,
  );
}
