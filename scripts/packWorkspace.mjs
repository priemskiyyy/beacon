import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workspace = fileURLToPath(new URL("..", import.meta.url));

export const artifacts = path.join(workspace, ".artifacts");

/** Where the verified tarballs are staged, one folder per package name, each with its `SHA256SUMS`. The publish workflow uploads this folder and publishes from it. */
export const release = path.join(artifacts, "release");

/** Runs a command and returns what it printed; a failure throws with everything the command said. */
export const run = (
  command,
  args,
  { cwd = workspace, env, timeout, merge = false } = {},
) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 256 * 1024 * 1024,
    timeout: timeout ?? 600_000,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed in ${cwd}:\n${result.stdout}\n${result.stderr}`,
      { cause: result.error },
    );
  }

  return merge ? `${result.stdout}${result.stderr}` : result.stdout;
};

const listFolders = (parent) =>
  readdirSync(path.join(workspace, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => path.join(workspace, parent, entry.name))
    .filter((folder) => existsSync(path.join(folder, "package.json")));

/** Every publishable package: `packages/*` and `packages/adapters/*`, with the manifest the source tree has. */
export const listPackages = () =>
  [...listFolders("packages"), ...listFolders("packages/adapters")].map(
    (folder) => ({
      folder,
      directory: path.relative(workspace, folder).split(path.sep).join("/"),
      manifest: JSON.parse(
        readFileSync(path.join(folder, "package.json"), "utf8"),
      ),
    }),
  );

const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

/** Packs a package the way pnpm publishes it (`workspace:` ranges rewritten, `publishConfig` applied), into `destination`. */
export const packPackage = (folder, destination) => {
  mkdirSync(destination, { recursive: true });

  const [first] = [
    JSON.parse(
      run("pnpm", ["pack", "--pack-destination", destination, "--json"], {
        cwd: folder,
      }),
    ),
  ].flat();

  return {
    name: first.name,
    version: first.version,
    tarball: first.filename,
    files: first.files.map((file) => file.path),
  };
};

/** Packs every package into `.artifacts/release/<name>/` beside a `SHA256SUMS` file, and returns what was packed. */
export const packWorkspace = () => {
  rmSync(release, { recursive: true, force: true });

  const staging = path.join(artifacts, "pack");

  rmSync(staging, { recursive: true, force: true });

  const packed = listPackages().map((entry) => {
    const result = packPackage(entry.folder, staging);
    const directory = path.join(release, result.name);
    const filename = path.basename(result.tarball);

    mkdirSync(directory, { recursive: true });
    copyFileSync(result.tarball, path.join(directory, filename));
    writeFileSync(
      path.join(directory, "SHA256SUMS"),
      `${hash(result.tarball)}  ${filename}\n`,
    );

    return { ...entry, ...result, tarball: path.join(directory, filename) };
  });

  rmSync(staging, { recursive: true, force: true });

  return packed;
};

/** The tarballs already staged by `packWorkspace`, after checking each against its `SHA256SUMS`, so a consumer is installed from exactly what the publish workflow would publish. */
export const readStagedTarballs = () => {
  if (!existsSync(release)) {
    throw new Error(
      "No packages are staged in .artifacts/release: run pnpm test:package first.",
    );
  }

  return listPackages().map((entry) => {
    const directory = path.join(release, entry.manifest.name);
    const sums = path.join(directory, "SHA256SUMS");

    if (!existsSync(sums)) {
      throw new Error(
        `${entry.manifest.name} is not staged: run pnpm test:package.`,
      );
    }

    const [checksum, filename] = readFileSync(sums, "utf8").trim().split(/\s+/);
    const tarball = path.join(directory, filename);

    if (hash(tarball) !== checksum) {
      throw new Error(`${tarball} does not match its SHA256SUMS.`);
    }

    return { ...entry, tarball };
  });
};

/** Extracts a tarball into `directory`; its files are under `package/`. */
export const extractTarball = (tarball, directory) => {
  mkdirSync(directory, { recursive: true });
  run("tar", ["-xzf", tarball, "-C", directory]);

  return path.join(directory, "package");
};
