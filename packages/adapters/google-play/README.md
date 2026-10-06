# @priemskiyyy/beacon-google-play

Google Play in-app updates as a [Beacon](../../core) route, over a native bridge you inject. Play owns eligibility, the flows and the version order; this adapter maps what it says and claims nothing as installed until a later boot shows the running build.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-google-play
```

## Create a route

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";

const beacon = new Beacon({
  scope, // scope.application is the Android application id
  running: { boot: { id: BOOT_ID } },
  routes: { binary: googlePlay({ bridge: NativeModules.PlayUpdates }) },
});
```

The running native release must be named the way Play names the offer: authority `scope.application`, domain `android-version-code`, and the version code as text, with `raw` holding `applicationId`, `versionName` and `versionCode`.

The bridge is a small native module you own, or an audited existing one, that keeps the `PlayBridge` contract: `AppUpdateInfo`, the Activity and the result launcher stay native, every start reacquires fresh information (Play allows one use of it), and it rejects when no Activity is available.

## What a check reports

| Play says                             | Route observation                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| not available                         | `none`, detail `not-available`: no update here, not proof no release exists             |
| available                             | `available`, named by the version code, with the flows Play allows, priority, staleness |
| a flow this app started is still held | `available` as a continuation of the immediate flow                                     |
| unknown, such as no Play services     | `unknown`: an environment that cannot say, never `none`                                 |

An update Play reports as already downloaded is prepared when the app starts, without any command.

## Commands

| Command    | Needs      | Impacts                                    | Receipt                  |
| ---------- | ---------- | ------------------------------------------ | ------------------------ |
| `download` | an offer   | `may-activate-on-next-start`               | `update-downloaded`      |
| `update`   | an offer   | `native-update-flow`, `javascript-restart` | `immediate-flow-started` |
| `restart`  | a prepared | `javascript-restart`                       | `completion-requested`   |

Each flow is its own command, so its impacts are its own and a participant is asked only about what the flow does. Every start reconfirms the offer against Play and refuses a changed one as stale. `download` answers when Play says the download ended, with Play's own progress and no invented total, and prepares the update without restarting the app. `restart` is the separate, guarded restart.

## What it does not do

It installs nothing and proves no installation: an accepted command is a request. Fake bridge tests verify state handling, not installation. A stable claim needs a real device with a real Play distribution, signing and version codes. A JavaScript abort only ends the local wait: it leaves the command `indeterminate`, since Play may still finish.
