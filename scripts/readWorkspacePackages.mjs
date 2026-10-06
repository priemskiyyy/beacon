import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const listFolders = (parent) =>
  readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => path.join(parent, entry.name))
    .filter((folder) => existsSync(path.join(folder, "package.json")));

// The entries a package publishes: the name a consumer imports, its built declarations and the source file the entry is built from, which sits under `src` where the subpath says (`./triggers/browser` is `src/triggers/browser.ts`, and `.` is `src/index.ts`).
const readEntries = (folder, manifest) =>
  Object.entries(manifest.exports ?? {}).flatMap(([subpath, target]) => {
    if (typeof target !== "object" || typeof target.types !== "string") {
      return [];
    }

    const declaration = path.resolve(folder, target.types);

    if (!existsSync(declaration)) {
      return [];
    }

    return [
      {
        module: `${manifest.name}${subpath.slice(1)}`,
        declaration,
        source: path.join(
          folder,
          "src",
          `${subpath === "." ? "index" : subpath.slice(2)}.ts`,
        ),
      },
    ];
  });

/** Every workspace package under `packages` and `packages/adapters`, with the entries it publishes, as the checks of the documentation read them. */
export const readWorkspacePackages = (workspace) =>
  [
    ...listFolders(path.join(workspace, "packages")),
    ...listFolders(path.join(workspace, "packages/adapters")),
  ].map((folder) => {
    const manifest = JSON.parse(
      readFileSync(path.join(folder, "package.json"), "utf8"),
    );

    return {
      name: manifest.name,
      folder,
      entries: readEntries(folder, manifest),
    };
  });
