import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { listPackages } from "./packWorkspace.mjs";

// tsdown appends `//# sourceMappingURL=<name>.d.ts.map` to every declaration
// file when sourcemaps are on, and writes no such map: a declaration map names
// the `.ts` sources, which a package does not ship. The comment would point
// every editor at a file the tarball does not contain, so it is removed here,
// after the build and before the pack.
const COMMENT = /\n?\/\/# sourceMappingURL=\S+\.d\.m?ts\.map\s*$/;

const listDeclarations = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listDeclarations(file);
    }

    return /\.d\.m?ts$/.test(entry.name) ? [file] : [];
  });

let stripped = 0;

for (const { folder } of listPackages()) {
  const dist = path.join(folder, "dist");

  for (const file of listDeclarations(dist)) {
    const source = readFileSync(file, "utf8");

    if (COMMENT.test(source)) {
      writeFileSync(file, `${source.replace(COMMENT, "")}\n`);
      stripped += 1;
    }
  }
}

console.log(`Removed the declaration map comment from ${stripped} files.`);
