# @priemskiyyy/beacon-code-push

The React Native CodePush family as a [Beacon](../../core) route and its running reader: Microsoft's `react-native-code-push` and the forks that kept its JavaScript API, `@revopush/react-native-code-push`, `@bravemobile/react-native-code-push` and `@appzung/react-native-code-push`. CodePush owns discovery, the download, the install and the rollback; this adapter maps what it says, says so when it cannot say more, and claims nothing as running until a later boot shows it.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-code-push @revopush/react-native-code-push
```

Install the fork you use. Microsoft's package is retired: its repository is archived and its service is gone, so it is for an app that serves updates itself.

## Create a route

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { codePushBundle, codePushUpdates } from "@priemskiyyy/beacon-code-push";
import CodePush from "@revopush/react-native-code-push";

const beacon = new Beacon({
  scope,
  running: { boot: { id: BOOT_ID }, bundle: codePushBundle(CodePush) },
  routes: { update: codePushUpdates({ codePush: CodePush }) },
});
```

You pass the CodePush module in: the adapter never imports it, so a test passes a fake and a server render loads nothing. For AppZung's package that is `import * as CodePush from "@appzung/react-native-code-push"`, since its default export is its decorator. The adapter configures none of it.

## What the app must do

The adapter never calls `sync`, `notifyAppReady`, `allowRestart` or `disallowRestart`, and the structural type it takes lists none of them. Two things stay the application's:

- **Keep the library quiet.** Wrap the root component with `CheckFrequency.MANUAL`. Without it the decorator calls `sync()`, which checks, downloads and installs on its own and installs a mandatory update immediately, and Beacon's state would not say what happened.
- **Call `notifyAppReady()`.** With `MANUAL` the decorator calls it when the root component mounts, and without the decorator you call it. A package that is not confirmed is rolled back at a later start.

```tsx
import CodePush from "@revopush/react-native-code-push";
import { Text } from "react-native";

const App = () => <Text>Notes</Text>;

export default CodePush({ checkFrequency: CodePush.CheckFrequency.MANUAL })(
  App,
);
```

## Options

`codePushUpdates({ codePush })` takes the module. `codePushBundle(codePush)` takes the same module and is the `bundle` running reader: `known` with authority `code-push`, domain `package-hash` and the package hash, or `unknown` with the reason `embedded-bundle` when CodePush reports no package. The `native` reader is yours: name the installed binary with authority the application id and domain `android-version-code` or `ios-build`, as the store adapters do.

## What a check reports

| CodePush says                            | Route observation                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| a package                                | `available`, named by its hash, with `label`, `mandatory` and `failedInstall` |
| a package whose hash is missing or blank | `available` under an identity that names nothing                              |
| `null`                                   | `none`, detail `no-package-for-binary`: never "up to date"                    |
| a rejection                              | the check fails and the last observation stays                                |

`null` is what CodePush answers for no update, for an update that needs a newer binary, for the hash the device already holds and for the hash inside the binary, and the forks add silent cases of their own: Microsoft and Revopush switch their API calls off after a failed request to their own cloud, Bravemobile swallows a failed fetch of its release history, and AppZung answers it while data transmission is off. So the route says that CodePush handed over no package for this binary, and never that nothing is newer or that nothing went wrong. The check asks with no argument.

## Commands

| Command    | Needs      | Impact                       | Binding            | Receipt            |
| ---------- | ---------- | ---------------------------- | ------------------ | ------------------ |
| `download` | an offer   | `may-activate-on-next-start` | `exact-instance`   | `update-staged`    |
| `reload`   | a prepared | `javascript-restart`         | `provider-current` | `reload-requested` |

`download` downloads the package the offer names and installs it with the mode the module calls `ON_NEXT_RESTART`, never an immediate one. Only CodePush listing that package as pending makes the route prepared and the command accepted; an install it does not confirm is `indeterminate`. A package that this device installed before and CodePush rolled back is `unsupported` with `previously-rolled-back`, and a package is spent once its install was asked for, since CodePush deletes the folder of a package it downloads. A staged package may also be picked up at a start nobody asked for, which `download` declares before the user agrees.

`reload` asks CodePush what is pending again, answers `stale` for another package or none, and calls `restartApp(true)`. `accepted` means the call returned: the route stays unresolved until `route.acknowledge()`, and only the next boot shows what runs. A package that was pending when a session opened is prepared without a command.

## What it does not do

It proves no installation, it does not call `notifyAppReady()`, and it never installs with a mode that restarts the app. Bravemobile's check can itself clear the update and restart the app when its release history rolls back to the binary, and Beacon cannot ask a participant first. What the library starts on its own is not observed. [The guide](../../../docs/code-push.md) has the detail.

## Verification

| What                                                                                                                                                                     | Status                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The structural type is satisfied by the real declarations of Microsoft 9.0.1, Revopush 2.6.2, Bravemobile 13.3.1 and AppZung 11.0.5, and not by AppZung's default export | proven by `codePushUpdates.contracts.ts`, typechecked against each install                                                                                                            |
| The route and the reader map every case above against a fake module, through Beacon, on Node and with the globals Hermes lacks removed                                   | proven by the tests; the fake is written from the forks' sources                                                                                                                      |
| What `null` means, the `_isDebugOnly` flag, `restartApp` returning a promise, the pending state, and the deletion of a package's folder on download                      | read in the forks' sources and native code; the JavaScript half of it, for the first three, was also run once by hand against a fake native module that this repository does not keep |
| A package downloaded, installed for the next start and listed as pending by a real native module, on each platform and in each fork                                      | UNVERIFIED: needs a device and an update server                                                                                                                                       |
| `restartApp(true)` replacing the runtime, and held back while restarts are disallowed                                                                                    | UNVERIFIED: read in Android code only                                                                                                                                                 |
| The rollback of a package when `notifyAppReady()` is not called                                                                                                          | UNVERIFIED: read in Microsoft's Android code only                                                                                                                                     |
| Each fork's server or release history giving one hash to a package in `checkForUpdate()`, `download()` and `getUpdateMetadata()`                                         | UNVERIFIED: the adapter binds by that hash, and a package of another one is not installed, not reported as prepared and not restarted for                                             |
| The native progress events, and Bravemobile's second stream when a patch falls back to the full archive                                                                  | UNVERIFIED                                                                                                                                                                            |
| The journal reading a reload back as `target-running` when the next launch runs the staged package                                                                       | proven by a test with a fake relaunch; UNVERIFIED after a real restart                                                                                                                |
| AppZung's behavior, past its types                                                                                                                                       | UNVERIFIED                                                                                                                                                                            |
| The running bundle in a development build, where Metro serves the bundle                                                                                                 | UNVERIFIED                                                                                                                                                                            |
