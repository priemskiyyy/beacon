# @priemskiyyy/beacon-native

The installed native build as a [Beacon](../../core) running reader, for a React Native or Expo app. It reads the version code or the build number from `expo-application` or `react-native-device-info` and names it the way the store adapters name their releases, so the journal and a support policy compare like with like. The SDK is yours: the package never imports it and never configures it.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-native
npx expo install expo-application
```

With `react-native-device-info` instead, install that and leave `expo-application` out. Both are optional peer dependencies.

## Create a reader

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
import { Platform } from "react-native";

const beacon = new Beacon({
  scope, // scope.application is the application id
  running: {
    boot: { id: BOOT_ID },
    native: expoApplication({
      application: Application,
      platform: Platform.OS === "ios" ? "ios" : "android",
      authority: scope.application,
    }),
  },
  routes: { binary: googlePlay({ bridge: playBridge }) },
});
```

`deviceInfo({ deviceInfo: DeviceInfo, platform, authority })` is the same over `react-native-device-info`, where `DeviceInfo` is its default export.

```ts
import { deviceInfo } from "@priemskiyyy/beacon-native";
import DeviceInfo from "react-native-device-info";

const native = deviceInfo({
  deviceInfo: DeviceInfo,
  platform: "ios",
  authority: scope.application,
});
```

## Options

| Option                        | Meaning                                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application` or `deviceInfo` | the module the application imported, typed structurally: its real types are proven to fit                                                                                                                  |
| `platform`                    | `android` or `ios`, which decides how the build is named. A `Platform.OS` that can also be `web` is yours to narrow                                                                                        |
| `authority`                   | the application id the route offers for, which is `scope.application`. A binary that reports another id is then unknown as `another-application`. Left out, the binary names itself and nothing is checked |
| `domain`                      | what the build numbers name, `android-version-code` or `ios-build` by default. Change it only for a manifest of your own that names them otherwise                                                         |

An `authority` or a `domain` that is empty or has a space around it is refused when the reader is made, with `INVALID_CONFIGURATION`.

## What it reports

| Field                | Android                                       | iOS                                            |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| `identity.authority` | the application id the binary reports         | the bundle id the binary reports               |
| `identity.domain`    | `android-version-code`                        | `ios-build`                                    |
| `identity.value`     | the version code as text                      | the build number (`CFBundleVersion`)           |
| `label`              | the version name                              | the marketing version                          |
| `raw`                | `applicationId`, `versionName`, `versionCode` | `applicationId`, `shortVersion`, `buildNumber` |

These are the words the Play adapter offers in and the App Store adapter reads (`appleMarketingVersion` takes `raw.shortVersion`), and the ones a standard manifest and a support policy use. A reader that spells any of them differently leaves the journal unable to say that an update ran: it answers `inconclusive`. Every value is text with no space around it, because the journal compares identities exactly.

| The SDK gave                                                                       | The identity                                                                                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| a build number and an application id                                               | `known`                                                                                                   |
| no build number: null, empty, spaces, or `unknown` from `react-native-device-info` | `unknown`, reason `build-not-read`                                                                        |
| no application id                                                                  | `unknown`, reason `application-not-read`                                                                  |
| another application's id than `authority`, as Expo Go running your code reports    | `unknown`, reason `another-application`, and none of its version numbers is kept in `raw` or as the label |

A build number is never read as zero, as null or as the text `unknown`. The marketing version stays in `raw` and as the label even where the build is unknown, unless the binary is another application's. The calls of `react-native-device-info` are synchronous: if one throws, the reader rejects, which Beacon publishes as a failed fact, and never as a build.

## What it does not do

- It does not read `expo-constants`: its `expoConfig` values come from the manifest, which an update can replace, where these are fixed for a binary.
- It does not name the JavaScript bundle. `expoBundle` of `@priemskiyyy/beacon-expo` reads that, and an over-the-air update changes it without changing the build number.
- It reads no store and compares nothing: the routes and the journal do.
- It reads the SDK when the session asks, and again only when a session opens again. A binary does not change while it runs.
- It has no reader for Capacitor, Tauri or Electron.

## Verification

| Claim                                                                                                                                                     | Status                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| The reader follows the running-reader contract: cold until read, the same release on every read, no empty or padded part                                  | Tested, `testRunningReader` over a fake of each SDK on both platforms            |
| Every unknown situation names its reason, and Expo Go's application id is refused                                                                         | Tested                                                                           |
| A build the Play adapter offered is named the same way when it runs, and the journal says `target-running`                                                | Tested through a real Beacon, the real Play route and a fake bridge              |
| `raw.shortVersion` is what `appleMarketingVersion` reads                                                                                                  | Tested against the real App Store adapter                                        |
| The real `expo-application` 57.0.3 and `react-native-device-info` 15.0.2 types satisfy the structural types; `expo-constants` and Electron's `app` do not | Typechecked in the `*.contracts.ts` files                                        |
| `react-native-device-info` answers `unknown` for what it cannot read                                                                                      | Read from its source, tested against a fake                                      |
| What `expo-application` returns in Expo Go, in a development build and in a release build                                                                 | UNVERIFIED: needs a device. Expo Go is expected to report its own application id |
| That `nativeBuildVersion` is the version code on Android and the build number on iOS, for each flavor and signing                                         | UNVERIFIED: needs a device and a store distribution                              |
| `react-native-device-info` on a device                                                                                                                    | UNVERIFIED: needs a device                                                       |
| Expo Go's own application id and build number on each platform                                                                                            | UNVERIFIED: needs a device                                                       |
