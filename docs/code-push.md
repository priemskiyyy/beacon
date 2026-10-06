---
description: "Map the React Native CodePush family onto a Beacon route: which fork to install, keeping its own automation off, the running bundle reader, what a check reports and what null means, the download and reload commands, and what no device has run."
---

# CodePush

`@priemskiyyy/beacon-code-push` makes the React Native CodePush family a route: Microsoft's `react-native-code-push` and the forks that kept its JavaScript API, `@revopush/react-native-code-push`, `@bravemobile/react-native-code-push` and `@appzung/react-native-code-push`. CodePush owns discovery, the download, the install and the rollback. The adapter maps what it says, says so when it cannot say more, and claims nothing as running until a later boot shows it.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-code-push @revopush/react-native-code-push
```

Install the fork you use, here Revopush's. The adapter imports none of them: you pass the module in, and its type is structural.

## Which CodePush

The four packages share one JavaScript API, and a test of the types proves the real declarations of each fit the one structural type the adapter uses. They differ in who serves the updates and whether anyone still maintains them. Dates are what npm and each project's own README said on 2026-09-30.

| Package                               | Version | Status                                                                                                                                                                                              | Where updates come from                               |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `react-native-code-push`              | 9.0.1   | Retired. Last published 2024-12-19. The repository's README says CodePush was retired on March 31, 2025, and archives the repository. No New Architecture: React Native 0.76 and later must opt out | App Center, which is gone, or a server you run        |
| `@revopush/react-native-code-push`    | 2.6.2   | Published 2026-09-13. Asks for React Native 0.83 or later                                                                                                                                           | Revopush's cloud, with byte-level diffs               |
| `@bravemobile/react-native-code-push` | 13.3.1  | Published 2026-09-17. React Native 0.77 to 0.86, on a TurboModule                                                                                                                                   | A release history you host, through your own function |
| `@appzung/react-native-code-push`     | 11.0.5  | Published 2026-06-29. Its types are checked against the adapter's, and nothing more                                                                                                                 | AppZung's service                                     |

What is checked and what is not, for each, is in [what no device has run](#what-no-device-has-run). The peers have no upper limit and start at the oldest release whose declarations fit the structural type: `react-native-code-push` 5.5.0, `@revopush/react-native-code-push` 1.0.0, `@bravemobile/react-native-code-push` 8.2.3 and `@appzung/react-native-code-push` 10.0.0 (before it the package has a default export only, which is not a module of these members). That is typechecked by `scripts/verify-peers.mjs` against each of those and the newest in the table, and is a check of declarations, never of a runtime. AppZung's package has no default export with these members: pass `import * as CodePush from "@appzung/react-native-code-push"`, since its default export is its decorator.

## Before the route

1. Install a fork and do its native setup, which its own documentation covers. The adapter changes none of it: no deployment key, server, release history, public key, install mode or check frequency.
2. **Keep the library quiet.** Wrap your root component with the `MANUAL` check frequency. Without it the decorator calls `sync()` when the root mounts, and `sync` checks, downloads and installs by itself, and installs a mandatory update immediately, which restarts the app. Beacon observes none of that, so its state would say something other than what happened.
3. **`notifyAppReady()` is yours.** With `MANUAL`, the decorator calls it once when the root component mounts. Without the decorator you call it yourself. An update that was installed for the next start is loaded at that start on trial, and Microsoft's Android code rolls it back at the start after that when `notifyAppReady()` was not called in between. Beacon never calls it.

```tsx
// src/App.tsx
import CodePush from "@revopush/react-native-code-push";
import { Text } from "react-native";

const Notes = () => <Text>Notes</Text>;

export const App = CodePush({ checkFrequency: CodePush.CheckFrequency.MANUAL })(
  Notes,
);
```

Bravemobile's decorator takes its `releaseHistoryFetcher` beside `checkFrequency`. Build and test with a release build: in a development build the bundle comes from Metro, not from a package CodePush installed.

## Create a route

The route reads the running bundle itself, and the installed binary is a `native` reader of yours. A CodePush package targets one binary version, so a policy that compares the two needs both. `deviceInfo` of [`@priemskiyyy/beacon-device-info`](device-info.md) names an Android build by its version code and an iOS build by its build number, in the words the store adapters use, and in an Expo app `expoApplication` of `@priemskiyyy/beacon-expo` does the same.

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { codePushUpdates } from "@priemskiyyy/beacon-code-push";
import { deviceInfo } from "@priemskiyyy/beacon-device-info";
import CodePush from "@revopush/react-native-code-push";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: "app-store",
  },
  running: { native: deviceInfo({ deviceInfo: DeviceInfo }) },
  routes: { update: codePushUpdates({ codePush: CodePush }) },
});
```

The route is a driver route on the `bundle` subject. It never calls `sync`, `notifyAppReady`, `allowRestart` or `disallowRestart`, and the type it takes lists one install mode, so an immediate install cannot be written. The module belongs to one open session at a time: a second Beacon that opens a route on it fails to open, and that route says `DRIVER_FAILED`. [React Native](expo.md#the-installed-binary) says more of the `native` reader and the rest of the app around it.

### The running bundle

`codePushBundle({ codePush: CodePush })` reads `getUpdateMetadata` for the package that runs, and never for one that is pending. `codePushUpdates` supplies it as the reader of the `bundle` subject, so a journal knows which package a reload reached with nothing in `running`. A reader you pass as `running.bundle` wins, so pass `codePushBundle` only to override that, or where no `codePushUpdates` route is given. It is made for the `bundle` subject, and `running.web` refuses it. The route never writes the fact.

| Fact       | Source                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity` | `known` with authority `code-push`, domain `package-hash`, the package hash; `unknown` with the reason `embedded-bundle` where CodePush reports no package |
| `label`    | the package's label, such as `v12`, or `null`                                                                                                              |
| `raw`      | `label` and `embedded`                                                                                                                                     |

The route names an offer and a prepared package the same way, so a [journal](journal.md) that asked for a reload can compare what it asked for with what runs. CodePush does not name the bundle inside the binary, so after a rollback to it the identity is unknown and a journal can only call it `inconclusive`. The forks also flag a package that sits on disk while the binary's own bundle runs, which happens in development builds, and the reader answers `embedded-bundle` for it too.

## What a check reports

The check calls `checkForUpdate()` with no argument, since the forks disagree on their order.

| CodePush says                            | Route observation                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| a package                                | `available`, named by its hash, with `label`, `mandatory` and `failedInstall` |
| a package whose hash is missing or blank | `available` with an identity that names nothing (`package-hash-missing`)      |
| `null`                                   | `none`, reason `no-decision`, detail `no-package-for-binary`                  |
| a rejection                              | the check fails and the last observation stays                                |

```ts
import { beacon } from "src/beacon";

const { observation } = beacon.route("update").state.get();

if (observation.status === "available") {
  const { label, mandatory, failedInstall } = observation.offer;

  console.info(label, mandatory, failedInstall);
}
```

`failedInstall` says this device installed the package before and CodePush rolled it back. Such an offer is shown and never downloaded: its `download` is `unsupported` with the reason `previously-rolled-back`. The offer names the package by its hash and carries no deployment key or release channel.

### What null means

`none` here is never "up to date". CodePush answers `null` for several things it does not tell apart, and the adapter cannot tell them apart either. The source of every fork says it answers `null` when:

- the server says there is no update for this binary;
- the server says there is one, but for a newer binary version;
- the update's hash is the hash of the package the device already holds, running or pending;
- the update's hash is the hash of the bundle inside the binary.

And, read in the sources, it also answers `null` without saying why when:

- **Microsoft and Revopush:** a request to the project's own cloud host came back with an HTTP status that is not a server error, a timeout or a rate limit. That check rejects, and the library then switches its API calls off for the rest of that JavaScript runtime: every later check answers `null` with one console line. Microsoft's host, App Center, was retired on March 31, 2025.
- **Bravemobile:** the release history could not be fetched, or has no enabled release, or its latest release has no download URL. It catches the error, logs it with `console.error` and answers `null`.
- **AppZung:** the application disabled data transmission.

So the route can say that CodePush handed over no package for this binary, and nothing more: not that no release exists, not that the update server was reached, and not that nothing went wrong. Microsoft, Revopush and AppZung reject when a request fails, and the route then says the check failed. Bravemobile's check swallows the failure, so there a failed fetch and an empty answer look the same.

Bravemobile's check can also act. When the newest enabled release of its release history is the binary's own version while a newer update runs, `checkForUpdate()` clears the installed update, allows restarts and restarts the app, inside the check. No participant is asked, and `disallowRestart()` does not stop it. Decide with your release history whether that can happen.

## Commands

| Command    | Needs      | Impact                       | Binding            | Receipt            |
| ---------- | ---------- | ---------------------------- | ------------------ | ------------------ |
| `download` | an offer   | `may-activate-on-next-start` | `exact-instance`   | `update-staged`    |
| `reload`   | a prepared | `javascript-restart`         | `provider-current` | `reload-requested` |

```ts
import { beacon } from "src/beacon";

export const applyUpdate = async () => {
  const route = beacon.route("update");
  const { observation } = route.state.get();

  if (observation.status !== "available") {
    return "nothing-on-offer";
  }

  const download = await route.download({ offer: observation.offer });

  if (download.status !== "accepted") {
    return download.status;
  }

  const { prepared } = route.state.get();

  if (prepared.status !== "ready") {
    return "nothing-prepared";
  }

  return (await route.reload({ prepared: prepared.value })).status;
};
```

### Download

`download` downloads the package the offer names and installs it for the next start, never for an earlier one: it asks for the install mode the module calls `ON_NEXT_RESTART` and for no other. Then it asks CodePush what is pending, and only a pending package with the offer's hash makes the route prepared and the command accepted.

| Result                                                                 | Outcome                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| downloaded, installed for the next start and listed as pending         | `accepted`, receipt `update-staged` with the hash and the label |
| the offer names nothing, because its hash was missing                  | `unsupported`, reason `package-hash-missing`                    |
| this device installed the package before and it was rolled back        | `unsupported`, reason `previously-rolled-back`                  |
| the last check found another package, or this one was staged already   | `stale`                                                         |
| the download or the install rejected                                   | `failed`, `COMMAND_FAILED`                                      |
| CodePush handed back a package with another hash                       | `failed`, and nothing is installed                              |
| the install returned and CodePush does not list the package as pending | `indeterminate`, reason `install-unconfirmed`                   |
| the caller stopped waiting, or the session ended, during the download  | `cancelled`, stage `session-ended`, and nothing is installed    |

`update-staged` is what CodePush confirmed: the package is installed for the next start, which its API calls pending. It is not running, and its name is not `installed` for that reason. It may also be picked up at a start nobody asked for, whether or not you reload, which is why `download` declares `may-activate-on-next-start` before the user agrees, and why a participant can list that impact to be asked. An `indeterminate` download leaves the route unresolved until `route.acknowledge()`, because the install may have taken effect.

A package is spent once its install has been asked for, whatever the install answered. CodePush deletes the folder it keeps a package in when it downloads that package, and the folder of an installed package is the one it runs from, so the same offer is never downloaded twice. The next check offers a package again, or does not, as CodePush decides. Progress comes from the download's own events, as a fraction of the bytes received, and is `null` when CodePush gave no total.

### Reload

`reload` takes the prepared reference and asks CodePush to restart the app for it. It asks again what is pending first, and a different package or none is `stale`. Then it calls `restartApp(true)`, which does nothing when no update is pending.

```ts
import { beacon } from "src/beacon";

const route = beacon.route("update");
const { prepared } = route.state.get();

if (prepared.status === "ready") {
  const outcome = await route.reload({ prepared: prepared.value });

  console.info(outcome.status);
}
```

`accepted` means the call returned. Every fork's `restartApp` returns a promise, though its declaration says it returns nothing, and Microsoft's, Revopush's and Bravemobile's does not wait for the native side, so a call that returned says nothing of a restart. The native side holds a restart back while the application has disallowed restarts. The adapter awaits what the call returns, so a rejection is a failed command and not an unhandled one. No code after it is guaranteed to run. The route stays unresolved, with its reservations kept, until you call `route.acknowledge()`, and only the next boot shows which package runs. With the [journal](journal.md) on, that boot compares the intent with the bundle it finds.

A package that was pending when a session opened is prepared without any command, so a restart that did not happen in time still leaves a target to reload. When nothing is pending the route says nothing, and `prepared` stays unknown: CodePush cannot say that nothing is prepared.

## What the library still does by itself

The adapter cannot stop what the application or the library starts on its own. None of it is observed, and the next check reports a package the library already installed as `null`, since its hash is now the one the device holds.

| What                                                           | Where                                            |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `sync()`, at mount or on resume                                | a decorator with a frequency other than `MANUAL` |
| a mandatory update installed immediately                       | `sync`, by default                               |
| a rollback to the binary, which clears the update and restarts | Bravemobile's `checkForUpdate()`                 |
| a rollback of a package that was not confirmed                 | the start after the one that loaded it           |

## What it does not do

- It proves no installation. `update-staged` is what CodePush listed as pending, `reload-requested` is a call that returned, and only a later boot shows what runs.
- It does not call `notifyAppReady()`. A package the application never confirms is rolled back at a later start, and Beacon learns of it only from what the bundle reader says after that start.
- It installs with `ON_NEXT_RESTART` alone. The modes that restart the app, and the ones that wait for a resume or a suspend, are the application's own, through `sync` or an install it makes itself.
- It does not configure the library and does not call `sync`, `allowRestart` or `disallowRestart`.
- It does not say that the device is up to date.

## What no device has run

Everything here is tested against a fake module in process, and also in an environment where the globals Hermes lacks are removed. The adapter's structural type is typechecked against the real declarations of all four packages, and the forks' sources and native code were read for what follows. The adapter was also run once by hand over the real JavaScript of Microsoft's, Revopush's and Bravemobile's packages, with a fake native module that keeps Android's state, and this repository does not keep that harness. No device, update server or store has run a line of this. Still to be seen:

- a package downloaded, installed for the next start and listed as pending by a real native module, on each platform and in each fork;
- `restartApp(true)` replacing the runtime, and being queued while restarts are disallowed, which Android's code shows and no run did;
- the rollback when `notifyAppReady()` is missing, read in Microsoft's Android code only;
- each fork's server or release history giving one hash to a package in `checkForUpdate()`, in `download()` and in `getUpdateMetadata()`. The adapter binds by that hash: a package of another hash is never installed, a pending package of another hash is never reported as prepared, and a reload for it is `stale`;
- the progress events of the native side, and Bravemobile's second stream when a patch falls back to the full archive;
- the running bundle in a development build, where Metro serves the bundle;
- AppZung past its types.

[Verification](verification.md) says what the tests prove.
