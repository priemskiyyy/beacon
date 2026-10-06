# @priemskiyyy/beacon-device-info

The installed native build as a [Beacon](../../core) running reader, for a React Native app that reads it with `react-native-device-info`. It reads the version code or the build number and names it the way the store adapters name their releases, so the journal and a support policy compare like with like. The SDK is yours: the package never imports it and never configures it. An Expo app reads the same facts from `expo-application` with `expoApplication` of [`@priemskiyyy/beacon-expo`](../expo).

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-device-info
pnpm add react-native-device-info
```

`react-native-device-info` is an optional peer dependency, open ended from 10.0.0 and checked up to 15: a check of declarations, never of what an older module does when it is called.

## Create a reader

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import { deviceInfo } from "@priemskiyyy/beacon-device-info";
import DeviceInfo from "react-native-device-info";

const beacon = new Beacon({
  scope, // scope.application is the application id, and scope.platform is Platform.OS
  running: { native: deviceInfo({ deviceInfo: DeviceInfo }) },
  routes: { binary: googlePlay({ bridge: playBridge }) },
});
```

The platform and the authority are the scope's, which the reader is given each time it runs: an Android build is its version code under `android-version-code`, an iOS build its build number under `ios-build`, and a scope of any other platform is unknown with the reason `unsupported-platform`, without the library being asked.

## Options

| Option       | Meaning                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deviceInfo` | the default export of `react-native-device-info`, or its module, typed structurally: its real types are proven to fit                                |
| `platform`   | `android` or `ios`, to override the scope's. It decides how the build is named                                                                       |
| `authority`  | the application id to compare the binary with, to override `scope.application`. A binary that reports another id is unknown as `another-application` |
| `domain`     | what the build numbers name, `android-version-code` or `ios-build` by default. Change it only for a manifest of your own that names them otherwise   |

An `authority` or a `domain` that is given and is empty or has a space around it is refused when the reader is made, with `INVALID_CONFIGURATION`.

## What it reports

| Field                | Android                                       | iOS                                            |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| `identity.authority` | the application id the binary reports         | the bundle id the binary reports               |
| `identity.domain`    | `android-version-code`                        | `ios-build`                                    |
| `identity.value`     | the version code as text                      | the build number (`CFBundleVersion`)           |
| `label`              | the version name                              | the marketing version                          |
| `raw`                | `applicationId`, `versionName`, `versionCode` | `applicationId`, `shortVersion`, `buildNumber` |

These are the words the Play adapter offers in and the App Store adapter reads (`appleMarketingVersion` takes `raw.shortVersion`), and the ones a standard manifest and a support policy use. A reader that spells any of them differently leaves the journal unable to say that an update ran: it answers `inconclusive`. Every value is text with no space around it, because the journal compares identities exactly.

| The library gave                                                                | The identity                                                                                              |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| a build number and a bundle id                                                  | `known`                                                                                                   |
| no build number: empty, spaces, or the text `unknown` that the library answers  | `unknown`, reason `build-not-read`                                                                        |
| no bundle id                                                                    | `unknown`, reason `application-not-read`                                                                  |
| another application's id than the scope's, as Expo Go running your code reports | `unknown`, reason `another-application`, and none of its version numbers is kept in `raw` or as the label |
| a scope of a platform that is not Android or iOS                                | `unknown`, reason `unsupported-platform`                                                                  |

A build number is never read as zero, as null or as the text `unknown`. The marketing version stays in `raw` and as the label even where the build is unknown, unless the binary is another application's. The calls of `react-native-device-info` are synchronous: if one throws, the reader rejects, which Beacon publishes as a failed fact, and never as a build.

## What it does not do

- It does not name the JavaScript bundle. `expoBundle` of `@priemskiyyy/beacon-expo` and `codePushBundle` of `@priemskiyyy/beacon-code-push` read that, and an over-the-air update changes it without changing the build number.
- It reads no store and compares nothing: the routes and the journal do.
- It reads the library when the session asks, and again only when a session opens again. A binary does not change while it runs.
- It has no reader for Capacitor, Tauri or Electron.

## Verification

| Claim                                                                                                                    | Status                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| The reader follows the running-reader contract: cold until read, the same release on every read, no empty or padded part | Tested, `testRunningReader` over a fake of the library on both platforms       |
| Every unknown situation names its reason, and Expo Go's application id is refused                                        | Tested                                                                         |
| The real `react-native-device-info` 15.0.2 types satisfy the structural type, and so does the 10.0.0 floor               | Typechecked in `src/deviceInfo.contracts.ts` and by `scripts/verify-peers.mjs` |
| `react-native-device-info` answers `unknown` for what it cannot read                                                     | Read from its source, tested against a fake                                    |
| `react-native-device-info` on a device                                                                                   | UNVERIFIED: needs a device                                                     |
