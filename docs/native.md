---
description: "Read the installed native build in a React Native or Expo app with expoApplication or deviceInfo, named the way the store adapters name their releases, so the journal and a support policy compare like with like."
---

# Native build

`@priemskiyyy/beacon-native` reads what the installed binary is: the version code on Android and the build number on iOS, from `expo-application` or `react-native-device-info`. It is the `native` running reader that the Play and App Store routes, the journal and a support policy compare against. It names the build in the words the store adapters use, because the journal compares identities exactly and answers `inconclusive` for a build named in any other words. It reads nothing but the binary and compares nothing.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-native
npx expo install expo-application
```

With `react-native-device-info`, install that instead. Both are optional peer dependencies, and the package imports neither: you pass the module in, typed structurally, so a test passes a fake and a server render loads nothing.

## Create a reader

```ts
// src/beacon.ts
import { Beacon, createBootId } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
import { Platform } from "react-native";

// The bridge of the Google Play page.
declare const playBridge: PlayBridge;

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: Platform.OS,
  distribution: "google-play",
};

export const beacon = new Beacon({
  scope,
  running: {
    boot: { id: createBootId() },
    native: expoApplication({
      application: Application,
      platform: Platform.OS === "ios" ? "ios" : "android",
      authority: scope.application,
    }),
  },
  routes: { binary: googlePlay({ bridge: playBridge }) },
});
```

`deviceInfo` is the same over `react-native-device-info`, where `DeviceInfo` is its default export:

```ts
import { deviceInfo } from "@priemskiyyy/beacon-native";
import DeviceInfo from "react-native-device-info";

export const native = deviceInfo({
  deviceInfo: DeviceInfo,
  platform: "ios",
  authority: "com.example.notes",
});
```

| Option                        | Meaning                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application` or `deviceInfo` | the module you imported. Its real types are proven to fit                                                                                                                                                   |
| `platform`                    | `android` or `ios`, which decides how the build is named. A `Platform.OS` that can also say `web` is yours to narrow                                                                                        |
| `authority`                   | the application id the route offers for, which is `scope.application`. A binary that reports another id is then unknown, as `another-application`. Left out, the binary names itself and nothing is checked |
| `domain`                      | what the build numbers name: `android-version-code` or `ios-build`. Change it only for a manifest of your own that names them otherwise                                                                     |

An `authority` or a `domain` that is empty or has a space around it is refused when the reader is made, with `INVALID_CONFIGURATION`.

## What it reports

| Field                | Android                                       | iOS                                            |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| `identity.authority` | the application id the binary reports         | the bundle id the binary reports               |
| `identity.domain`    | `android-version-code`                        | `ios-build`                                    |
| `identity.value`     | the version code as text                      | the build number (`CFBundleVersion`) as text   |
| `label`              | the version name                              | the marketing version                          |
| `raw`                | `applicationId`, `versionName`, `versionCode` | `applicationId`, `shortVersion`, `buildNumber` |

These are the names the rest of Beacon reads. The [Play adapter](google-play.md) names its offers by the version code under `scope.application` and `android-version-code`, so a build that ran is the same identity as the update that was offered. The [App Store adapter](app-store.md) reads `raw.shortVersion` as the order of what runs. A [standard manifest](http.md) and a [support policy](support.md#a-minimum-native-build) use the same words. Every value is text with no space around it.

| The SDK gave                                                                              | The identity                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| a build number and an application id                                                      | `known`                                                                                                   |
| no build number: null, empty, spaces, or the text `unknown` of `react-native-device-info` | `unknown`, reason `build-not-read`                                                                        |
| no application id                                                                         | `unknown`, reason `application-not-read`                                                                  |
| another id than `authority`, as Expo Go running your code reports                         | `unknown`, reason `another-application`, and none of its version numbers is kept in `raw` or as the label |

A build is never read as zero, as null or as the text `unknown`. Where the build is unknown the marketing version still stays in `raw` and as the label, unless the binary is another application's. The calls of `react-native-device-info` are synchronous: if one throws, the reader rejects, which Beacon publishes as a failed fact, never as a build. [Troubleshooting](troubleshooting.md#the-installed-binary-is-unknown) says what to do about each reason.

## What the journal does with it

The Play route writes an intent before `update` or `restart`, naming the build it offered. After the restart the next boot reads the binary through this reader, and the journal says `target-running` when the build is the one offered, `target-not-running` when it is the old one, and `inconclusive` when either side is unknown or named in other words. A test in the package runs exactly this, with the real Play route over a fake bridge.

## What it does not do

- It does not read `expo-constants`. Its manifest values can come from an update, where the native values are fixed for a binary.
- It does not name the JavaScript bundle. `expoBundle` reads that, and an over-the-air update changes it without changing the build number.
- It reads no store and compares nothing.
- It reads the SDK when a session asks for the running facts, and again only when a session opens again.
- It has no reader for Capacitor, Tauri or Electron.

## What no device has run

The reader is tested in process against fakes of both SDKs, and their real types are proven to fit. Still to be seen on a device: what `expo-application` returns in Expo Go, in a development build and in a release build, in particular that Expo Go answers with its own application id and that `nativeBuildVersion` is the version code on Android and the build number on iOS for each flavor; and what `react-native-device-info` gives on a device. See [React Native](react-native.md#what-no-device-has-run).
