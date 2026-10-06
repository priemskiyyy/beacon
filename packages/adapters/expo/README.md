# @priemskiyyy/beacon-expo

Expo Updates as a [Beacon](../../core) route, and the installed native build from `expo-application`. Discovery, eligibility, asset fetching, verification and startup selection stay with `expo-updates`; this adapter maps what the SDK says in full and claims nothing as running until a later boot shows it.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-expo
npx expo install expo-updates expo-application
```

`expo-updates` is an optional peer dependency from 0.24 (Expo SDK 50) with no upper limit: the types the adapter reads were typechecked against 0.24.0 and 58.0.11, which says nothing of what an older SDK does when it is called. `expo-application`, which `expoApplication` reads, is an optional peer dependency too, with no upper limit from 5.0.0, typechecked against 5.0.0 and 58.0.2.

## Create a route

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { expoApplication, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Application from "expo-application";
import * as Updates from "expo-updates";

const beacon = new Beacon({
  scope,
  running: { native: expoApplication({ application: Application }) },
  routes: { ota: expoUpdates({ updates: Updates }) },
});
```

You pass the `expo-updates` module in: the adapter never imports it, so a test passes a fake and a server render loads nothing. It changes none of its configuration, whatever a remote manifest says. The route reads which update runs itself, with `expoBundle({ updates: Updates })`, which it supplies as the reader of the `bundle` subject: a reader you pass as `running.bundle` wins. The installed binary, which the store routes and the journal compare against, is the `native` running fact that `expoApplication` reads from `expo-application`.

## What a check reports

| SDK result                              | Route observation                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| an available update                     | `available`, named by the id its server assigned                                 |
| a rollback to the embedded update       | `available` as a rollback, with an identity nobody named                         |
| a valid answer with neither             | `none`, with the SDK's own reason as the detail                                  |
| a rejection                             | the check fails and the last observation stays                                   |
| updates disabled (development, Expo Go) | `unknown`, an environment that cannot check, never `none`                        |
| a call refused as unavailable           | `unknown` too: a development client says `isEnabled` and then refuses every call |

## Commands

| Command    | Needs      | Impact                       | Binding            | Receipt                                                      |
| ---------- | ---------- | ---------------------------- | ------------------ | ------------------------------------------------------------ |
| `download` | an offer   | `may-activate-on-next-start` | `provider-current` | `update-prepared`, `rollback-prepared`, `no-new-preparation` |
| `reload`   | a prepared | `javascript-restart`         | `provider-current` | `reload-requested`                                           |

`download` fetches the provider's current selection, which may differ from the offer: the receipt says `same`, `different` or `unknown`, and a different update gets a prepared reference of its own. A valid answer that is not new prepares nothing and never becomes a prepared update. An update that was downloaded can be selected at a later start whether or not you reload, so `download` declares that before the user agrees.

`reload` restarts the JavaScript runtime; no code after it is guaranteed to run, and the route stays unresolved until you call `route.acknowledge()`.

## The installed binary

`expoApplication({ application: Application })` reads the version code on Android and the build number on iOS, and names them the way the store adapters name their releases, so the journal and a support policy compare like with like. The platform is `scope.platform` (`"ios"` or `"android"`, what `Platform.OS` says) and the authority is `scope.application`, so it needs nothing else: `platform`, `authority` and `domain` are there to override. A scope of any other platform is `unknown` with the reason `unsupported-platform`, and the module is not asked.

| Field                | Android                                       | iOS                                            |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| `identity.authority` | the application id the binary reports         | the bundle id the binary reports               |
| `identity.domain`    | `android-version-code`                        | `ios-build`                                    |
| `identity.value`     | the version code as text                      | the build number (`CFBundleVersion`)           |
| `label`              | the version name                              | the marketing version                          |
| `raw`                | `applicationId`, `versionName`, `versionCode` | `applicationId`, `shortVersion`, `buildNumber` |

These are the words the Play adapter offers in and the App Store adapter reads (`appleMarketingVersion` takes `raw.shortVersion`), and a reader that spells them differently leaves the journal unable to say that an update ran. A value the module gave as null or empty is `unknown` with the reason `build-not-read` or `application-not-read`, never a build named null, and a binary of another application than `scope.application`, such as Expo Go running your code, is `unknown` with the reason `another-application` and keeps none of its version numbers. [The guide](../../../docs/expo.md#the-installed-binary) has the options and the reasons. In an app that reads the binary with `react-native-device-info`, use [`@priemskiyyy/beacon-device-info`](../device-info).

## What it does not do

Autonomous checks and downloads that `expo-updates` runs at startup are not observed: this is the command profile. A hook bridge over `useUpdates()` is not part of this release. `expoApplication` does not read `expo-constants`, whose manifest values can come from an update, and does not name the JavaScript bundle; what `expo-application` returns in Expo Go, in a development build and in a release build has not been run on a device.
