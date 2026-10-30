# @priemskiyyy/beacon-expo

Expo Updates as a [Beacon](../../core) route, `applyUpdate` for the banner's button, the installed native build from `expo-application`, and a fake `expo-updates` for development and tests. Discovery, eligibility, asset fetching and startup selection stay with `expo-updates`; this adapter maps what the SDK says in full and claims nothing as running until a later boot shows it.

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-expo
npx expo install expo-updates expo-application
```

`expo-updates` (from 0.24, Expo SDK 50) and `expo-application` (from 5.0.0) are optional peer dependencies with no upper limit: the types the adapter reads were typechecked against 0.24.0 and 58.0.11, and 5.0.0 and 58.0.2, which says nothing of what an older SDK does when it is called.

## Example

```ts
import { Beacon } from "@priemskiyyy/beacon";
import {
  applyUpdate,
  expoApplication,
  expoUpdates,
} from "@priemskiyyy/beacon-expo";
import * as Application from "expo-application";
import * as Updates from "expo-updates";

const beacon = new Beacon({
  scope,
  running: { native: expoApplication({ application: Application }) },
  routes: { ota: expoUpdates({ updates: Updates }) },
});

// The banner's button: download what is on offer, then restart into it.
const applied = await applyUpdate(beacon.route("ota"));
```

You pass the module in: the adapter never imports it, so a test passes a fake and a server render loads nothing, and it changes none of the SDK's configuration. The route reads which update runs itself, so a journal knows what a restart reached.

## What it exports

| Export                                                             | Does                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `expoUpdates({ updates })`                                         | the route: `download` prepares the provider's current selection, `reload` restarts the JavaScript runtime                |
| `applyUpdate(route)`                                               | `download`, then `reload`; answers `{ step, outcome }` and never throws                                                  |
| `expoApplication({ application, platform?, authority?, domain? })` | the `native` reader: the version code on Android and the build number on iOS, under the scope's application and platform |
| `expoBundle({ updates })`                                          | the `bundle` reader, which the route supplies by itself: pass it only to override that                                   |
| `createFakeUpdates({ available?, disabled? })`                     | from `@priemskiyyy/beacon-expo/mock`: a fake `expo-updates` for Expo Go, Storybook and Jest                              |

Expo Go and a development build run no updates: the route says `unknown` with `unsupported-environment`, never "no update", and its commands are `unsupported`. A rollback to the embedded update is an offer with an identity nobody named.

## Learn more

[The Expo guide](../../../docs/expo.md) has what a check reports, each command and receipt, runtime versions and channels, and the installed binary's reasons. [React Native](../../../docs/react-native.md) takes an Expo app from this route to a banner, a guard and a forced-upgrade screen.
