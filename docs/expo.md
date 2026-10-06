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

`expo-updates` does not run in Expo Go. Its own documentation says to test with a development build or a release build; see [Expo Go, a development build and a release build](react-native.md#expo-go-a-development-build-and-a-release-build). To see the banner there anyway, pass [a fake](#a-fake-for-development-and-tests) for the module.

The `expo-updates` peer has no upper limit and starts at 0.24, the release of Expo SDK 50: the structural type the adapter reads was typechecked against 0.24.0 and against 58.0.11, and each release in between that was tried, by `scripts/verify-peers.mjs`. That is a check of declarations. What an older SDK does when the adapter calls it has not been run, and [the decision record](decisions.md) says so.

## Create a route

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
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
    bundle: expoBundle({ updates: Updates }),
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

`expoBundle({ updates: Updates })` is the reader of the running JavaScript bundle. Pass it as the `bundle` reader. The route never writes it.

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

### Apply an update

A banner that says "Update" runs both commands, and `applyUpdate` of the package does that: it downloads what is on offer, then reloads what is prepared. It takes the route handle, never throws, and answers where it stopped and how that command settled.

```ts
import { applyUpdate } from "@priemskiyyy/beacon-expo";

import { beacon } from "src/beacon";

export const update = async () => {
  const applied = await applyUpdate(beacon.route("ota"));

  if (applied.step === "none") {
    return "Nothing to install.";
  }

  if (applied.step === "download") {
    if (applied.outcome.status === "accepted") {
      return "Nothing new was prepared.";
    }

    return "The update could not be downloaded.";
  }

  if (applied.outcome.status === "blocked") {
    return "Save your work, then update.";
  }

  if (applied.outcome.status === "accepted") {
    return "Restarting.";
  }

  return "Try again.";
};
```

| `step`     | Where it stopped                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`     | nothing was on offer and nothing was prepared, so the SDK was asked for nothing                                                                                                                                |
| `download` | at the download. Its `outcome` is refused, blocked or failed, or it is accepted and prepared nothing to reload (`no-new-preparation`)                                                                          |
| `reload`   | at the restart, whatever its `outcome`, with the accepted `download` that came before it. Its receipt says whether what was prepared is what was offered (`offered`). It is `null` when nothing was downloaded |

It is the two commands of the route in their order and nothing more, so every guard applies: a participant that blocks the restart is the `outcome` of the `reload` step with its reasons, the [journal](journal.md) records the intent before it, and an update that an earlier `download` prepared is reloaded when nothing is on offer any more. An accepted reload is a request: the route stays unresolved until `route.acknowledge()`, and a second call meets that and downloads nothing again. A banner that should tell the user before it downloads, since `download` may activate on the next start, calls the two commands itself, as below.

### Download

`download` fetches the provider's current selection, which may differ from the offer. The receipt says how they relate.

```ts
import { beacon } from "src/beacon";

const route = beacon.route("ota");
const { observation } = route.state.get();

if (observation.status === "available") {
  const outcome = await route.download({ offer: observation.offer });

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
  const outcome = await route.reload({ prepared: prepared.value });

  console.info(outcome.status);
}
```

`accepted` means the SDK verified that the app can reload and posted the request. No code after it is guaranteed to run. The route stays unresolved, with its reservations kept, until you call `route.acknowledge()`, and only the next boot shows which update runs. With the [journal](journal.md) on, that boot compares the intent with the bundle it finds.

`Updates.reloadAsync()` replaces the JavaScript runtime and selects the update the SDK downloaded most recently, not necessarily the one the user was shown. Everything of the old runtime goes with it: `AppState` listeners, timers, module variables and the Beacon with its observations. What stays is the journal's record, in the storage you gave it, which is why a reload of an application that wants to know what it reached needs a journal; [React Native](react-native.md#what-a-reload-keeps) has the wiring. A rollback to the embedded update names no identity, so a journal can only call it `inconclusive`.

`prepared` starts at `unknown` and becomes `ready` only through a `download` of this session. Autonomous downloads that `expo-updates` runs on its own are not observed.

## A fake for development and tests

`@priemskiyyy/beacon-expo/mock` has `createFakeUpdates`, a fake `expo-updates` module for the two places the real one says nothing: Expo Go and a development build, where updates are off, and a test. It goes where the module goes.

```ts
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import * as Updates from "expo-updates";

import { expoUpdates } from "@priemskiyyy/beacon-expo";

export const routes = {
  ota: expoUpdates({
    updates: __DEV__ ? createFakeUpdates({ available: true }) : Updates,
  }),
};
```

| Option      | Default | What the fake is                                                                                                                   |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `available` | `false` | a build whose server has one update: a check offers it, a fetch downloads it, every time. Without it a check says nothing is there |
| `disabled`  | `false` | a build with updates off, as Expo Go: `isEnabled` is `false`, no update is running, and each call is refused as the SDK refuses it |

The banner then shows in Expo Go, in Storybook and in a screenshot test, and `download` and `reload` answer as they would. `reloadAsync` restarts nothing, so the route stays unresolved after a reload, as it does on a device. `calls` counts what the fake was asked (`checks`, `fetches` and `reloads`), and a method assigned over it is what the route meets, which is how a test scripts a failure or a slow fetch:

```ts
import { createGate } from "@priemskiyyy/beacon/mock";
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";

const updates = createFakeUpdates({ available: true });
const gate = createGate();

gate.hold();

const fetchUpdate = updates.fetchUpdateAsync;

updates.fetchUpdateAsync = async () => {
  await gate.wait();

  return fetchUpdate();
};
```

It is a fake of what the route reads, so it proves how Beacon maps a result and never that an update launched. [Testing](testing.md#testing-in-an-expo-app) has it under Jest.

## What it does not do

Autonomous checks and downloads that `expo-updates` runs at startup are not observed: this is the command profile. A hook bridge over `useUpdates()` is not part of this release. A stable claim needs a real device with a real update server; the adapter is typechecked against the real SDK types and tested against a fake. See [verification](verification.md).
