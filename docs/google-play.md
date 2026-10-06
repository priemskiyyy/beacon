---
description: "Open the Google Play page of your app from a Beacon route with no native code, and map Play's in-app updates onto a route over a native bridge you write: the flows, the download, update and restart commands, and what a fake bridge cannot prove."
---

# Google Play

`@priemskiyyy/beacon-google-play` has two routes for two needs, and only one of them asks for native code.

| Route                    | For                                                                                      | What it needs                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `playStore`              | sending the user to the Play Store page of your app, such as a forced upgrade            | React Native's `Linking`, and nothing else        |
| `googlePlay({ bridge })` | Play's in-app updates: the flexible and the immediate flow, the download and the restart | a native module you write, which no package ships |

Start with `playStore`. `googlePlay` is for an application that has written a bridge over Play's in-app update library, and [below](#in-app-updates-needs-a-native-bridge-you-write) says what that takes.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-google-play
```

## Open the store page

`playStore({ applicationId, linking })` is a route with one command, `openStore`, and no bridge. It opens `market://details?id=<applicationId>`, which the Play Store app handles, and where nothing handles that link, such as a device without Play services, it opens `https://play.google.com/store/apps/details?id=<applicationId>` in the browser instead. The destination is built from the application id alone, never from a manifest, and an id that is not the dotted name Android gives one throws `INVALID_CONFIGURATION` when the route is made.

```ts
// src/storeBeacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import {
  GOOGLE_PLAY_DISTRIBUTION,
  playStore,
} from "@priemskiyyy/beacon-google-play";
import { Linking } from "react-native";

const APPLICATION = "com.example.notes";

export const beacon = new Beacon({
  // scope.application is the Android application id.
  scope: {
    application: APPLICATION,
    environment: "production",
    platform: "android",
    distribution: GOOGLE_PLAY_DISTRIBUTION,
  },
  routes: {
    store: playStore({ applicationId: APPLICATION, linking: Linking }),
  },
});
```

| Command     | Needs             | Impact             | Binding             | Receipt                   |
| ----------- | ----------------- | ------------------ | ------------------- | ------------------------- |
| `openStore` | an optional offer | `external-handoff` | `store-destination` | `store-handoff-requested` |

`openStore` has the shape the App Store route declares, so an application in both stores names one route and calls one method, whichever it is on ([App Store](app-store.md#one-store-route-for-both-platforms)). The route asks nobody what the store has, so it never offers an update: its check is no offer, detail `no-lookup`, which is not proof that no release exists. A remediation that names this route is `usable` as soon as the session is open, since its page needs no offer, and the outcome of `openStore` says when the provider refuses, as it does for a build of another distribution.

```ts
import { beacon } from "src/storeBeacon";

const outcome = await beacon.route("store").openStore();

if (outcome.status === "unsupported") {
  console.info("This build is not from Google Play:", outcome.reason);
}
```

A resolved call means only that the OS accepted the request: the user can decline or never return, and nothing says an installation began. A link that neither opens is a failed command, `COMMAND_FAILED`, and never an accepted one.

### Which distribution

The store adapters agree on three words for `scope.distribution`: `google-play` for a build Google Play serves, `app-store` for one the App Store serves, and `development` for a build in neither, such as a debug build or an emulator. `GOOGLE_PLAY_DISTRIBUTION` is the first as a constant, and the App Store package exports the second as `APP_STORE_DISTRIBUTION`. `playStore` answers only for `google-play`: in a scope that says another, `openStore` is `unsupported` with the reason `other-distribution` and opens nothing, so a sideloaded or development build is never sent to a store page it did not come from.

## In-app updates: needs a native bridge you write

`googlePlay({ bridge })` makes Play's in-app updates a route, over a native bridge you inject. **No package ships that bridge**: it is a native module over Play's in-app update library that you write or audit, in Kotlin or Java, and nothing in this repository has run it on a device or against a real Play distribution. Use `playStore` unless you need the flows. Play owns eligibility, the flows and the version order. The adapter maps what it says and claims nothing as installed until a later boot shows the running build.

## The bridge

The bridge is a small native module you own, or an audited existing one, that keeps the `PlayBridge` contract:

| Method                         | Does                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `getUpdateInfo()`              | a fresh query of Play, in the four categories below              |
| `startFlexible()`              | starts the flexible flow: `started`, `cancelled` or `failed`     |
| `startImmediate()`             | starts the immediate flow with the same three answers            |
| `completeUpdate()`             | asks Play to complete a downloaded update                        |
| `addInstallListener(listener)` | reports Play's install state; answers how to remove the listener |

`AppUpdateInfo`, the Activity and the result launcher stay native. Every start reacquires fresh information itself, because Play allows one use of it. Every start rejects when no Activity is available.

### The bridge in React Native

A native module cannot hand JavaScript a function, so `addInstallListener` cannot be a method of the module itself. The module has four methods that return promises and emits Play's install state as an event, and a thin JavaScript object makes the bridge. React Native's `NativeEventEmitter` takes the module, which has to implement `addListener` and `removeListeners` as every event source does, and its subscription is what `addInstallListener` answers a way to remove.

```ts
// src/playBridge.ts
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import { NativeEventEmitter, NativeModules } from "react-native";

// Your native module, or one you have audited. It emits "PlayInstallState" with { status, bytesDownloaded, totalBytes }.
const { PlayUpdates } = NativeModules;

const events = new NativeEventEmitter(PlayUpdates);

export const playBridge: PlayBridge = {
  getUpdateInfo: () => PlayUpdates.getUpdateInfo(),
  startFlexible: () => PlayUpdates.startFlexible(),
  startImmediate: () => PlayUpdates.startImmediate(),
  completeUpdate: () => PlayUpdates.completeUpdate(),
  addInstallListener: (listener) => {
    const subscription = events.addListener("PlayInstallState", listener);

    return () => subscription.remove();
  },
};
```

Make the object once, at module scope. A bridge belongs to one open session at a time, and two objects over one module would not be known as the same bridge. `NativeModules` is untyped, so nothing checks that your module keeps what the object promises: prove it with a test of your module, since no type can.

## Create a route

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import { expoApplication } from "@priemskiyyy/beacon-expo";
import * as Application from "expo-application";

import { playBridge } from "src/playBridge";

export const beacon = new Beacon({
  // scope.application is the Android application id.
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: "google-play",
  },
  running: { native: expoApplication({ application: Application }) },
  routes: { binary: googlePlay({ bridge: playBridge }) },
});
```

The running native release is read by `expoApplication` of `@priemskiyyy/beacon-expo`, or by `deviceInfo` of `@priemskiyyy/beacon-device-info` over `react-native-device-info`, under the platform and the application of the scope, and it is named the way Play names the offer, or the two would be incomparable and nothing would be reported as running the offered build:

| Field                | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `identity.authority` | `scope.application`, the Android application id            |
| `identity.domain`    | `android-version-code`                                     |
| `identity.value`     | the version code as text                                   |
| `label`              | the version name                                           |
| `raw`                | `applicationId`, `versionName` and `versionCode` (as text) |

The route is a driver route on the `native` subject. A bridge belongs to one open session at a time: a second Beacon that opens a route on the same bridge fails to open it, and that route says `DRIVER_FAILED`. A hot reload that makes the Beacon again is no second Beacon while the provider follows it: the old session ends first ([React Native](react-native.md#the-provider)).

What runs is the installed build, which the `native` running reader says. `expo-application` gives `nativeBuildVersion`, the version code as text, and [Expo](expo.md#the-installed-binary) says what the reader reports and when it says unknown: a binary of another application, such as Expo Go, is never named as your build.

The bridge is not read until a session opens, and the adapter never enables asset-pack deletion or any other destructive option.

## What a check reports

Play's answer has four categories, and they are kept apart.

| `PlayUpdateInfo` | Route observation                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `not-available`  | `none`, detail `not-available`: no update here, not proof that no release exists                   |
| `available`      | `available`, named by the version code, with the flows Play allows now, its priority and staleness |
| `in-progress`    | `available` as a continuation of the immediate flow this app started and Play still holds          |
| `unknown`        | `unknown`, reason `unsupported-environment`: such as no Play services, never `none`                |

An offer carries these provider facts beside the release:

| Field           | Meaning                                               |
| --------------- | ----------------------------------------------------- |
| `flows`         | `flexible` and `immediate`, whichever Play allows now |
| `priority`      | Play's own priority                                   |
| `stalenessDays` | how long the update has been available, or `null`     |
| `inProgress`    | a flow this app started that Play still holds         |

Priority and staleness stay provider facts. They never become support policy on their own: if you want a policy that reads them, write it; see [support](support.md).

The release is named by the version code: authority is `scope.application`, the domain is `android-version-code`, and the value is the code as text. A continuation and a download Play reports without a version have an unknown identity: a finished download is named by the query that reported it, or by the offer whose flow awaited it, and an install event alone names no version. A version code is not a display name.

### Prepared

An update Play reports as already downloaded is prepared when the app starts, without any command, and a download finishing while the app runs prepares it too. Only the flexible flow prepares a target. Progress comes from Play's own byte counts, `null` when Play gave none, and a total is never invented.

## Commands

| Command    | Needs      | Impacts                                    | Binding            | Receipt                  |
| ---------- | ---------- | ------------------------------------------ | ------------------ | ------------------------ |
| `download` | an offer   | `may-activate-on-next-start`               | `provider-current` | `update-downloaded`      |
| `update`   | an offer   | `native-update-flow`, `javascript-restart` | `provider-current` | `immediate-flow-started` |
| `restart`  | a prepared | `javascript-restart`                       | `provider-current` | `completion-requested`   |

Each flow is its own command, so its impacts are its own and a participant is asked only about what the flow does.

Every start reconfirms the offer against Play with a fresh query, and a changed one settles as `stale`. A flow Play does not allow for this update is `unsupported` with the reason `flow-not-allowed`.

```ts
import { beacon } from "src/beacon";

export const applyBinaryUpdate = async () => {
  const route = beacon.route("binary");
  const { observation } = route.state.get();

  if (observation.status !== "available") {
    return "nothing-on-offer";
  }

  const { offer } = observation;

  if (offer.flows.includes("flexible")) {
    const download = await route.download({ offer });

    if (download.status !== "accepted") {
      return download.status;
    }

    const { prepared } = route.state.get();

    if (prepared.status !== "ready") {
      return "nothing-prepared";
    }

    return (await route.restart({ prepared: prepared.value })).status;
  }

  if (offer.flows.includes("immediate")) {
    return (await route.update({ offer })).status;
  }

  return "no-flow-allowed";
};
```

### Download

`download` starts the flexible flow and answers when Play says the download ended, with Play's own progress. It prepares the update without restarting the app.

| Play says                    | Outcome                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| downloaded                   | `accepted`, receipt `update-downloaded`                                             |
| the user declined the prompt | `cancelled`, stage `consent`                                                        |
| the download was canceled    | `cancelled`, stage `download`                                                       |
| failed                       | `failed`, `COMMAND_FAILED`                                                          |
| the session ended meanwhile  | `indeterminate`, reason `aborted-after-dispatch`; the route records `session-ended` |

### Update

`update` is Play's blocking flow, and it is disruptive from the moment it starts. If a flow was already started and Play still holds it, the offer is a continuation and `update` resumes it. `accepted` means Play's own UI took over. There is no promise that JavaScript keeps running.

### Restart

`restart` is the separate, guarded restart of a downloaded update. `accepted` is the native call made, and the restart belongs to Play. It replaces the realm, so the route stays unresolved until `route.acknowledge()`.

## What it does not do

It installs nothing and proves no installation: an accepted command is a request. Fake bridge tests verify state handling, not installation. A stable claim needs a real device with a real Play distribution, signing and version codes. A JavaScript abort only ends the local wait: it leaves the command `indeterminate`, because Play may still finish. Nothing has run against Play yet; see [verification](verification.md).
