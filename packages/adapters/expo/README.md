# @priemskiyyy/beacon-expo

Expo Updates as a [Beacon](../../core) route. Discovery, eligibility, asset fetching, verification and startup selection stay with `expo-updates`; this adapter maps what the SDK says in full and claims nothing as running until a later boot shows it.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-expo expo-updates
```

## Create a route

```ts
import { Beacon, createBootId } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";

const beacon = new Beacon({
  scope,
  running: { boot: { id: createBootId() }, bundle: expoBundle(Updates) },
  routes: { ota: expoUpdates({ updates: Updates }) },
});
```

You pass the `expo-updates` module in: the adapter never imports it, so a test passes a fake and a server render loads nothing. It changes none of its configuration, whatever a remote manifest says. `expoBundle` says which update runs. The installed binary, which the store routes and the journal compare against, is the `native` running fact that `expoApplication` of [`@priemskiyyy/beacon-native`](../native) reads from `expo-application`.

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

## What it does not do

Autonomous checks and downloads that `expo-updates` runs at startup are not observed: this is the command profile. A hook bridge over `useUpdates()` is not part of this release.
