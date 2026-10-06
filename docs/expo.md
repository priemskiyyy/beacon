---
description: "Map Expo Updates onto a Beacon route: what a check reports, the download and reload commands, their receipts, and what expo-updates keeps to itself."
---

# Expo

`@priemskiyyy/beacon-expo` makes Expo Updates a route. Discovery, eligibility, asset fetching, verification and startup selection stay with `expo-updates`. The adapter maps what the SDK says in full and claims nothing as running until a later boot shows it.

This page is the adapter. [React Native](react-native.md) is the whole app around it: the provider, checks on foreground, the journal's storage and the installed binary.

## Before the route

1. Install the SDK with `npx expo install expo-updates`, which picks the version of your SDK, and the packages with `pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-expo`. To read the installed binary as well, which the store routes and the journal compare against, add `npx expo install expo-application` and `pnpm add @priemskiyyy/beacon-native`.
2. Configure updates once with `eas update:configure`. It writes `runtimeVersion` and `updates.url` to `app.json`, and sets a channel on the build profiles of `eas.json`. The adapter changes none of these.
3. Build the binary with that channel, and publish updates to the same channel: `eas update --channel production --message "..."`.

`expo-updates` does not run in Expo Go. Its own documentation says to test with a development build or a release build; see [Expo Go, a development build and a release build](react-native.md#expo-go-a-development-build-and-a-release-build).

## Create a route

```ts
// src/beacon.ts
import { Beacon, createBootId } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    // Yours to say. The App Store route answers only for "app-store".
    distribution: "app-store",
  },
  running: {
    boot: { id: createBootId() },
    bundle: expoBundle(Updates),
    native: expoApplication({
      application: Application,
      platform: Platform.OS === "ios" ? "ios" : "android",
      authority: "com.example.notes",
    }),
  },
  routes: { ota: expoUpdates({ updates: Updates }) },
});
```

You pass the `expo-updates` module in. The adapter never imports it, so a test passes a fake and a server render loads nothing. It changes none of its configuration, whatever a remote manifest says: no update URL, header, channel or anti-bricking setting.

The route is a driver route on the `bundle` subject. The module belongs to one open session at a time: a second Beacon that opens a route on it fails to open, and that route says `DRIVER_FAILED`.

### The running bundle

`expoBundle(Updates)` is the reader of the running JavaScript bundle. Pass it as the `bundle` reader. The route never writes it.

| Fact       | Source                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `identity` | `known` with authority `expo-updates`, domain `update`, the update id; `unknown` with the reason `updates-disabled` when updates are off |
| `label`    | `null`                                                                                                                                   |
| `raw`      | `channel`, `runtimeVersion`, `embedded` and `emergency`                                                                                  |

### The installed binary

`expoUpdates` and `expoBundle` say which update runs, which an over-the-air update changes without changing the binary. The binary itself, its version code or build number, is the `native` running fact, which `expoApplication` of `@priemskiyyy/beacon-native` reads from `expo-application`. It is named the way the Play and App Store adapters name their releases, and a binary of another application, such as Expo Go, is unknown and never your build. [React Native](react-native.md#what-the-binary-is) has the fields and the reasons.

## What a check reports

| SDK result                              | Route observation                                         |
| --------------------------------------- | --------------------------------------------------------- |
| an available update                     | `available`, named by the id its server assigned          |
| a rollback to the embedded update       | `available` as a rollback, with an identity nobody named  |
| a valid answer with neither             | `none`, with the SDK's own reason as the detail           |
| a rejection                             | the check fails and the last observation stays            |
| updates disabled (development, Expo Go) | `unknown`, an environment that cannot check, never `none` |
| a call refused as unavailable           | the same, `unknown`: see the next section                 |

The offer carries `kind`: `update` or `rollback-to-embedded`. A rollback has an unknown identity with the reason `embedded-rollback`, since the SDK does not name the embedded update. An update id is a UUID and is written in lowercase, as the SDK reports the running update's, so an id a server wrote in capitals still names the update that later runs.

### Where updates cannot run

`Updates.isEnabled` is `false` when updates are switched off in the configuration, when the update URL or the runtime version is missing, or when the SDK cannot open its storage, and Expo Go runs no updates. A development client is different: it reports `true` and then refuses `checkForUpdateAsync` and `fetchUpdateAsync` from native code with `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`, and a debug build refuses from JavaScript with `ERR_UPDATES_DISABLED`. The adapter answers all of these the same way: the check is `unknown` with the reason `unsupported-environment`, and a download or reload is `unsupported` with `updates-disabled`. Any other rejection, such as a timeout, is still a failed check.

### Runtime versions and channels

A build asks its update server for an update of its own runtime version, and on its own channel. The Expo Updates protocol has the server answer with the most recent update that matches the request's `expo-runtime-version`, so an update published for another runtime is never offered, and the answer is `none` with the detail `noUpdateAvailableOnServer`. That says nothing about whether a release for another runtime exists. A binary too old to get any update is a support question, which a policy over the `native` running fact and a store route answer; see [support](support.md). The runtime version a build runs is in `raw.runtimeVersion` of the running bundle, and its channel in `raw.channel`.

The SDK's other reasons for no update are kept as the detail: `updateRejectedBySelectionPolicy`, `updatePreviouslyFailed`, `rollbackRejectedBySelectionPolicy` and `rollbackNoEmbeddedConfiguration`.

## Commands

| Command    | Needs      | Impact                       | Binding            | Receipt                                                      |
| ---------- | ---------- | ---------------------------- | ------------------ | ------------------------------------------------------------ |
| `download` | an offer   | `may-activate-on-next-start` | `provider-current` | `update-prepared`, `rollback-prepared`, `no-new-preparation` |
| `reload`   | a prepared | `javascript-restart`         | `provider-current` | `reload-requested`                                           |

Both are `unsupported` with the reason `updates-disabled` while updates are off, and when the SDK refuses the call as unavailable, as [below](#where-updates-cannot-run).

### Download

`download` fetches the provider's current selection, which may differ from the offer. The receipt says how they relate.

```ts
import { beacon } from "src/beacon";

const route = beacon.route("ota");
const { observation } = route.state.get();

if (observation.status === "available") {
  const outcome = await route.download({ offer: observation.offer.ref });

  if (outcome.status === "accepted") {
    const { receipt } = outcome;

    if (receipt.kind === "update-prepared") {
      console.info("Prepared", receipt.update.id, "which is", receipt.offered);
    } else if (receipt.kind === "rollback-prepared") {
      console.info("Prepared the embedded update, which is", receipt.offered);
    } else {
      console.info("The provider had nothing new to prepare.");
    }
  }
}
```

`offered` is `same`, `different` or `unknown`. A different update gets a prepared reference of its own, so the user is never told about one update and given another. A valid answer that is not new prepares nothing and never becomes a prepared update: `no-new-preparation`.

An update that was downloaded can be selected at a later start whether or not you reload. That is why `download` declares `may-activate-on-next-start` before the user agrees, and why a participant can list that impact to be asked.

### Reload

`reload` takes the prepared reference and restarts the JavaScript runtime.

```ts
import { beacon } from "src/beacon";

const route = beacon.route("ota");
const { prepared } = route.state.get();

if (prepared.status === "ready") {
  const outcome = await route.reload({ prepared: prepared.value.ref });

  console.info(outcome.status);
}
```

`accepted` means the SDK verified that the app can reload and posted the request. No code after it is guaranteed to run. The route stays unresolved, with its reservations kept, until you call `route.acknowledge()`, and only the next boot shows which update runs. With the [journal](journal.md) on, that boot compares the intent with the bundle it finds.

`Updates.reloadAsync()` replaces the JavaScript runtime and selects the update the SDK downloaded most recently, not necessarily the one the user was shown. Everything of the old runtime goes with it: `AppState` listeners, timers, module variables and the Beacon with its observations. What stays is the journal's record, in the storage you gave it, which is why a reload of an application that wants to know what it reached needs a journal; [React Native](react-native.md#what-a-reload-keeps) has the wiring. A rollback to the embedded update names no identity, so a journal can only call it `inconclusive`.

`prepared` starts at `unknown` and becomes `ready` only through a `download` of this session. Autonomous downloads that `expo-updates` runs on its own are not observed.

## What it does not do

Autonomous checks and downloads that `expo-updates` runs at startup are not observed: this is the command profile. A hook bridge over `useUpdates()` is not part of this release. A stable claim needs a real device with a real update server; the adapter is typechecked against the real SDK types and tested against a fake. See [verification](verification.md).
