import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspacePackages } from "./readWorkspacePackages.mjs";

// The SDK peers of the adapters are open ended from the oldest release whose
// declarations their structural types fit, and this proves each floor: every
// case installs the floor, and the newest release it was run against, in a
// directory of its own outside the workspace, and typechecks what the adapter
// takes against the real declarations, as the contract file of the adapter
// does against the release the workspace pins. A floor that is not the one
// the adapter's `package.json` names fails, and so does an SDK that no longer
// fits. It is a check of the declarations and never of a runtime, and it
// needs the network, so it is not part of `pnpm check`: run it after changing
// a structural SDK type and before a release. Run `pnpm build` first.
//
//   node scripts/verify-peers.mjs [sdk ...]
const workspace = fileURLToPath(new URL("..", import.meta.url));

const typescript = path.join(workspace, "node_modules/typescript/bin/tsc");

const paths = Object.fromEntries(
  readWorkspacePackages(workspace).flatMap(({ entries }) =>
    entries.map(({ module, declaration }) => [module, [declaration]]),
  ),
);

assert(
  paths["@priemskiyyy/beacon"] !== undefined,
  "The core is not built: run `pnpm build` first, so the structural types are read from the built declarations.",
);

const NOT_ANY = "type IsAny<T> = 0 extends 1 & T ? true : false;";

const CASES = [
  {
    sdk: "expo-updates",
    adapter: "expo",
    floor: "0.24.0",
    also: ["58.0.11"],
    check: `
import type { UpdatesLike } from "@priemskiyyy/beacon-expo";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";
${NOT_ANY}
// A module whose types did not resolve would be \`any\` and satisfy everything.
export const resolved: IsAny<ReturnType<typeof Updates.checkForUpdateAsync>> = false;
export const fits: UpdatesLike = Updates;
export const route = expoUpdates({ updates: Updates });
export const reader = expoBundle({ updates: Updates });
`,
  },
  {
    sdk: "expo-application",
    adapter: "native",
    floor: "1.0.0",
    also: ["58.0.2"],
    check: `
import type { ApplicationLike } from "@priemskiyyy/beacon-native";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
${NOT_ANY}
export const resolved: IsAny<typeof Application.nativeBuildVersion> = false;
export const fits: ApplicationLike = Application;
export const reader = expoApplication({ application: Application, platform: "ios" });
`,
  },
  {
    sdk: "react-native-device-info",
    adapter: "native",
    floor: "4.0.1",
    also: ["15.0.2"],
    check: `
import type { DeviceInfoLike } from "@priemskiyyy/beacon-native";
import { deviceInfo } from "@priemskiyyy/beacon-native";
import DeviceInfo from "react-native-device-info";
import * as DeviceInfoModule from "react-native-device-info";
${NOT_ANY}
export const resolved: IsAny<typeof DeviceInfo.getBuildNumber> = false;
export const fits: DeviceInfoLike = DeviceInfo;
export const fitsModule: DeviceInfoLike = DeviceInfoModule;
export const reader = deviceInfo({ deviceInfo: DeviceInfo, platform: "ios" });
`,
  },
  {
    sdk: "react-native-code-push",
    adapter: "code-push",
    floor: "5.5.0",
    also: ["9.0.1"],
    check: `
import type { CodePushLike } from "@priemskiyyy/beacon-code-push";
import { codePushBundle, codePushUpdates } from "@priemskiyyy/beacon-code-push";
import CodePush from "react-native-code-push";
${NOT_ANY}
export const resolved: IsAny<ReturnType<typeof CodePush.checkForUpdate>> = false;
export const fits: CodePushLike = CodePush;
export const route = codePushUpdates({ codePush: CodePush });
export const reader = codePushBundle({ codePush: CodePush });
`,
  },
  {
    sdk: "@revopush/react-native-code-push",
    adapter: "code-push",
    floor: "1.0.0",
    also: ["2.6.2"],
    check: `
import type { CodePushLike } from "@priemskiyyy/beacon-code-push";
import { codePushUpdates } from "@priemskiyyy/beacon-code-push";
import CodePush from "@revopush/react-native-code-push";
${NOT_ANY}
export const resolved: IsAny<ReturnType<typeof CodePush.checkForUpdate>> = false;
export const fits: CodePushLike = CodePush;
export const route = codePushUpdates({ codePush: CodePush });
`,
  },
  {
    sdk: "@bravemobile/react-native-code-push",
    adapter: "code-push",
    floor: "8.2.3",
    also: ["13.3.1"],
    check: `
import type { CodePushLike } from "@priemskiyyy/beacon-code-push";
import { codePushUpdates } from "@priemskiyyy/beacon-code-push";
import CodePush from "@bravemobile/react-native-code-push";
${NOT_ANY}
export const resolved: IsAny<ReturnType<typeof CodePush.checkForUpdate>> = false;
export const fits: CodePushLike = CodePush;
export const route = codePushUpdates({ codePush: CodePush });
`,
  },
  {
    // From 10.0.0 the package has named exports, which is what `import * as` reads; an older release has a default export only.
    sdk: "@appzung/react-native-code-push",
    adapter: "code-push",
    floor: "10.0.0",
    also: ["11.0.5"],
    check: `
import type { CodePushLike } from "@priemskiyyy/beacon-code-push";
import { codePushUpdates } from "@priemskiyyy/beacon-code-push";
import * as CodePush from "@appzung/react-native-code-push";
${NOT_ANY}
export const resolved: IsAny<ReturnType<typeof CodePush.checkForUpdate>> = false;
export const fits: CodePushLike = CodePush;
export const route = codePushUpdates({ codePush: CodePush });
`,
  },
  {
    sdk: "@react-native-firebase/remote-config",
    adapter: "firebase-remote-config",
    floor: "25.0.0",
    also: ["26.4.0"],
    // The native SDK reads the application module of its own release.
    install: (version) => [
      `@react-native-firebase/remote-config@${version}`,
      `@react-native-firebase/app@${version}`,
    ],
    check: `
import type { RemoteConfigLike, RemoteConfigModuleLike, RemoteValueLike } from "@priemskiyyy/beacon-firebase-remote-config";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import type * as NativeSdk from "@react-native-firebase/remote-config";
${NOT_ANY}
declare const native: NativeSdk.RemoteConfig;
declare const nativeSdk: typeof NativeSdk;
declare const value: NativeSdk.Value;
export const resolved: IsAny<typeof native.fetchTimeMillis> = false;
export const fitsInstance: RemoteConfigLike = native;
export const fitsModule: RemoteConfigModuleLike<NativeSdk.RemoteConfig> = nativeSdk;
export const fitsValue: RemoteValueLike = value;
export const source = firebaseRemoteConfig({
  remoteConfig: native,
  sdk: nativeSdk,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
});
`,
  },
  {
    // Earlier releases have no `exports` map with types, which the bundler resolution of the workspace needs.
    sdk: "firebase",
    adapter: "firebase-remote-config",
    floor: "9.8.3",
    also: ["12.19.0"],
    check: `
import type { RemoteConfigLike, RemoteConfigModuleLike, RemoteValueLike } from "@priemskiyyy/beacon-firebase-remote-config";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import type * as WebSdk from "firebase/remote-config";
${NOT_ANY}
declare const web: WebSdk.RemoteConfig;
declare const webSdk: typeof WebSdk;
declare const value: WebSdk.Value;
export const resolved: IsAny<typeof web.fetchTimeMillis> = false;
export const fitsInstance: RemoteConfigLike = web;
export const fitsModule: RemoteConfigModuleLike<WebSdk.RemoteConfig> = webSdk;
export const fitsValue: RemoteValueLike = value;
export const source = firebaseRemoteConfig({
  remoteConfig: web,
  sdk: webSdk,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
});
`,
  },
];

// The peers the SDKs reach for that are not under test come from the workspace, so their types are the ones of the repository.
const SHARED = ["react", "react-native", "@types/react", "@types/node"];

const requested = process.argv.slice(2);
const failures = [];

const check = ({ sdk, adapter, floor, also, install, check: source }) => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(workspace, "packages/adapters", adapter, "package.json"),
      "utf8",
    ),
  );

  // The claim and the proof are one number.
  if (manifest.peerDependencies[sdk] !== `>=${floor}`) {
    failures.push(
      `${adapter} asks ${sdk} ${manifest.peerDependencies[sdk]}, and the floor proven here is >=${floor}.`,
    );
  }

  for (const version of [floor, ...also]) {
    const dir = mkdtempSync(path.join(tmpdir(), "beacon-peers-"));

    try {
      mkdirSync(path.join(dir, "node_modules"), { recursive: true });
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "probe", private: true }),
      );

      const installed = spawnSync(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--legacy-peer-deps",
          "--no-package-lock",
          ...(install?.(version) ?? [`${sdk}@${version}`]),
        ],
        { cwd: dir, encoding: "utf8" },
      );

      if (installed.status !== 0) {
        failures.push(
          `${sdk}@${version} did not install: ${installed.stderr.split("\n")[0]}`,
        );

        continue;
      }

      for (const shared of SHARED) {
        const from = path.join(workspace, "node_modules", shared);
        const to = path.join(dir, "node_modules", shared);

        if (existsSync(from) && !existsSync(to)) {
          mkdirSync(path.dirname(to), { recursive: true });
          symlinkSync(from, to);
        }
      }

      writeFileSync(path.join(dir, "check.ts"), source);
      writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true,
            verbatimModuleSyntax: true,
            esModuleInterop: true,
            skipLibCheck: true,
            noEmit: true,
            types: [],
            baseUrl: ".",
            paths,
          },
          include: ["check.ts"],
        }),
      );

      const result = spawnSync("node", [typescript, "-p", "tsconfig.json"], {
        cwd: dir,
        encoding: "utf8",
      });

      if (result.status === 0) {
        console.log(`${sdk}@${version}: fits`);

        continue;
      }

      const errors = result.stdout
        .split("\n")
        .filter((line) => line.includes("error TS"));

      failures.push(
        `${sdk}@${version} does not fit the ${adapter} adapter:\n  ${errors.slice(0, 3).join("\n  ")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
};

for (const entry of CASES) {
  if (requested.length > 0 && !requested.includes(entry.sdk)) {
    continue;
  }

  check(entry);
}

assert.deepEqual(failures, [], `Peer range problems:\n${failures.join("\n")}`);
console.log(`Verified the floors of ${CASES.length} SDK peers.`);
