# @priemskiyyy/beacon-google-play

Google Play for [Beacon](../../core), as two routes for two needs. `playStore` opens the Play Store page of your app, with no native code of your own. `googlePlay({ bridge })` maps Play's in-app updates, and **needs a native bridge you write**: no package ships one, and nothing has run it on a device. Play owns eligibility, the flows and the version order; this adapter maps what it says and claims nothing as installed until a later boot shows the running build.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-google-play
```

## Open the store page

```ts
import { Beacon } from "@priemskiyyy/beacon";
import {
  GOOGLE_PLAY_DISTRIBUTION,
  playStore,
} from "@priemskiyyy/beacon-google-play";
import { Linking } from "react-native";

const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: GOOGLE_PLAY_DISTRIBUTION,
  },
  routes: {
    store: playStore({ applicationId: "com.example.notes", linking: Linking }),
  },
});

await beacon.route("store").openStore();
```

`openStore` opens `market://details?id=<applicationId>` and, where nothing handles it, the web page of the store. It has the shape the App Store route of [`@priemskiyyy/beacon-app-store`](../app-store) declares, so one route name and one call serve both stores. It answers only for the `google-play` distribution: for a scope that says another it is `unsupported` with the reason `other-distribution` and opens nothing. The route never offers an update, since nobody tells it what the store has.

## In-app updates: needs a native bridge you write

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";

const beacon = new Beacon({
  scope, // scope.application is the Android application id
  routes: { binary: googlePlay({ bridge: playBridge }) },
});
```

The running native release must be named the way Play names the offer: authority `scope.application`, domain `android-version-code`, and the version code as text, with `raw` holding `applicationId`, `versionName` and `versionCode`. [`@priemskiyyy/beacon-expo`](../expo) reads it that way, `expoApplication({ application: Application })` over `expo-application`, and so does `deviceInfo({ deviceInfo: DeviceInfo })` of [`@priemskiyyy/beacon-device-info`](../device-info) over `react-native-device-info`: the platform and the authority are the scope's.

The bridge is an object over a small native module you own, or an audited existing one, that keeps the `PlayBridge` contract: `AppUpdateInfo`, the Activity and the result launcher stay native, every start reacquires fresh information (Play allows one use of it), and it rejects when no Activity is available. A native module cannot answer the function `addInstallListener` answers, so the object is a few lines of JavaScript over `NativeEventEmitter`; [the guide](../../../docs/google-play.md#the-bridge-in-react-native) has them.

## What `googlePlay` reports

| Play says                             | Route observation                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| not available                         | `none`, detail `not-available`: no update here, not proof no release exists             |
| available                             | `available`, named by the version code, with the flows Play allows, priority, staleness |
| a flow this app started is still held | `available` as a continuation of the immediate flow                                     |
| unknown, such as no Play services     | `unknown`: an environment that cannot say, never `none`                                 |

An update Play reports as already downloaded is prepared when the app starts, without any command.

## `googlePlay` commands

| Command    | Needs      | Impacts                                    | Receipt                  |
| ---------- | ---------- | ------------------------------------------ | ------------------------ |
| `download` | an offer   | `may-activate-on-next-start`               | `update-downloaded`      |
| `update`   | an offer   | `native-update-flow`, `javascript-restart` | `immediate-flow-started` |
| `restart`  | a prepared | `javascript-restart`                       | `completion-requested`   |

Each flow is its own command, so its impacts are its own and a participant is asked only about what the flow does. Every start reconfirms the offer against Play and refuses a changed one as stale. `download` answers when Play says the download ended, with Play's own progress and no invented total, and prepares the update without restarting the app. `restart` is the separate, guarded restart.

## What it does not do

It installs nothing and proves no installation: an accepted command is a request. Fake bridge tests verify state handling, not installation. A stable claim needs a real device with a real Play distribution, signing and version codes. A JavaScript abort only ends the local wait: it leaves the command `indeterminate`, since Play may still finish.
