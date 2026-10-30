# @priemskiyyy/beacon-device-info

The installed native build as a [Beacon](../../core) running reader, for a React Native app that reads it with `react-native-device-info`. It reads the version code or the build number and names it the way the store adapters name their releases, so the journal and a support policy compare like with like. The SDK is yours: the package never imports it and never configures it. An Expo app reads the same facts from `expo-application` with `expoApplication` of [`@priemskiyyy/beacon-expo`](../expo).

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-device-info
pnpm add react-native-device-info
```

`react-native-device-info` is an optional peer dependency, open ended from 10.0.0 and checked up to 15: a check of declarations, never of what an older module does when it is called.

## Example

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

A value the library could not read, including its text `unknown`, makes the identity `unknown` with a named reason (`build-not-read`, `application-not-read`, `another-application`, `unsupported-platform`), never a build named `unknown`.

## Learn more

[The device info guide](../../../docs/device-info.md) has what differs from `expoApplication`, and [the installed binary](../../../docs/expo.md#the-installed-binary) the fields, every reason and what the journal does with them. It does not name the JavaScript bundle: `codePushBundle` and `expoBundle` read that.
