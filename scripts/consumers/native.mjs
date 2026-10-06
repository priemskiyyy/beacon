// The adapters over a native SDK, each with the real SDK from npm: the device
// info reader, the four CodePush modules the code-push adapter claims, and Remote
// Config on both the React Native and the web SDK. The SDKs are typechecked, never
// run: a device is what runs them.
export const NATIVE_PACKAGES = [
  "@priemskiyyy/beacon",
  "@priemskiyyy/beacon-device-info",
  "@priemskiyyy/beacon-code-push",
  "@priemskiyyy/beacon-firebase-remote-config",
];

export const nativeSdks = [
  "react-native-device-info",
  "react-native-code-push",
  "@appzung/react-native-code-push",
  "@bravemobile/react-native-code-push",
  "@revopush/react-native-code-push",
  "@react-native-firebase/app",
  "@react-native-firebase/remote-config",
  "firebase",
];

export const nativeFiles = {
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "types": [],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
`,

  "src/beacon.ts": `import { Beacon, minimumBuild } from "@priemskiyyy/beacon";
import { codePushBundle, codePushUpdates } from "@priemskiyyy/beacon-code-push";
import { deviceInfo } from "@priemskiyyy/beacon-device-info";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import * as RemoteConfig from "@react-native-firebase/remote-config";
import CodePush from "react-native-code-push";
import DeviceInfo from "react-native-device-info";

const config = firebaseRemoteConfig({
  remoteConfig: RemoteConfig.getRemoteConfig(),
  sdk: RemoteConfig,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
});

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: "google-play",
  },
  running: {
    native: deviceInfo({ deviceInfo: DeviceInfo }),
    bundle: codePushBundle({ codePush: CodePush }),
  },
  routes: { update: codePushUpdates({ codePush: CodePush }) },
  // Written inline, with no remediation: the Beacon's own routes do not decide which route it names.
  policy: minimumBuild({
    source: config.select((document) => document.minimumBuild),
  }),
});
`,

  // The other CodePush modules and the web SDK satisfy the same structural types.
  "src/forks.ts": `import { codePushUpdates } from "@priemskiyyy/beacon-code-push";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import { deviceInfo } from "@priemskiyyy/beacon-device-info";
import AppZungDefault from "@appzung/react-native-code-push";
import * as AppZung from "@appzung/react-native-code-push";
import Brave from "@bravemobile/react-native-code-push";
import * as WebRemoteConfig from "firebase/remote-config";
import { getRemoteConfig } from "firebase/remote-config";
import * as DeviceInfoModule from "react-native-device-info";
import Revopush from "@revopush/react-native-code-push";

export const forks = [
  codePushUpdates({ codePush: AppZung }),
  codePushUpdates({ codePush: Brave }),
  codePushUpdates({ codePush: Revopush }),
];

export const web = firebaseRemoteConfig({
  remoteConfig: getRemoteConfig(),
  sdk: WebRemoteConfig,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
});

export const fromModule = deviceInfo({ deviceInfo: DeviceInfoModule });

// @ts-expect-error -- the library is the SDK's, not a random object.
deviceInfo({ deviceInfo: {} });

// @ts-expect-error -- the default export of AppZung's package is its decorator: the module is imported whole.
codePushUpdates({ codePush: AppZungDefault });
`,
};
