---
description: "Read the installed native build in a React Native app that does not use Expo with deviceInfo over react-native-device-info, named the way the store adapters name their releases, so the journal and a support policy compare like with like."
---

# Device info

`@priemskiyyy/beacon-device-info` reads what the installed binary is from `react-native-device-info`: the version code on Android and the build number on iOS. It is the `native` running reader that the Play and App Store routes, the journal and a support policy compare against, named in the words the store adapters use, because the journal compares identities exactly and answers `inconclusive` for a build named in any other words. It reads nothing but the binary and compares nothing.

An Expo app has the same reader over `expo-application` in `@priemskiyyy/beacon-expo`, and the fields, the reasons and what the journal does with it are the same: [the installed binary](expo.md#the-installed-binary) has them. This page is what differs.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-device-info
pnpm add react-native-device-info
```

`react-native-device-info` is an optional peer dependency, open ended from 10.0.0 and typechecked up to 15, and the package imports it nowhere: you pass its default export in, typed structurally, so a test passes a fake and a server render loads nothing.

## Create a reader

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import { deviceInfo } from "@priemskiyyy/beacon-device-info";
import DeviceInfo from "react-native-device-info";
import { Platform } from "react-native";

// The bridge of the Google Play page.
declare const playBridge: PlayBridge;

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: "google-play",
  },
  running: { native: deviceInfo({ deviceInfo: DeviceInfo }) },
  routes: { binary: googlePlay({ bridge: playBridge }) },
});
```

The platform and the authority are the scope's: the reader is given the scope each time it runs, so the platform is `scope.platform` (`"ios"` or `"android"`, which is what `Platform.OS` says) and the authority is `scope.application`. A scope of any other platform is `unknown` with the reason `unsupported-platform`, and the library is not asked.

| Option       | Meaning                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deviceInfo` | the default export of `react-native-device-info`, or its module. Its real types are proven to fit                                                     |
| `platform`   | `android` or `ios`, to override the scope's                                                                                                           |
| `authority`  | the application id to compare the binary with, to override `scope.application`. A binary that reports another id is unknown, as `another-application` |
| `domain`     | what the build numbers name: `android-version-code` or `ios-build`. Change it only for a manifest of your own that names them otherwise               |

An `authority` or a `domain` that is given and is empty or has a space around it is refused when the reader is made, with `INVALID_CONFIGURATION`.

## What differs from `expoApplication`

- `react-native-device-info` answers the text `unknown` where it has no value, and the reader takes that for a value that was not read: the identity is `unknown` with the reason `build-not-read` or `application-not-read`, never a build named `unknown`.
- Its calls are synchronous. If one throws, the reader rejects, which Beacon publishes as a failed fact and never as a build.
- The bundle id it reports is the application id. A binary of another application, such as Expo Go running your code, is `unknown` with the reason `another-application`.

[Troubleshooting](troubleshooting.md#the-installed-binary-is-unknown) says what to do about each reason.

## What no device has run

The reader is tested in process against a fake of the library, and its real types are proven to fit. Still to be seen on a device: what `react-native-device-info` gives in each flavor of a build. See [React Native](react-native.md#what-no-device-has-run).
