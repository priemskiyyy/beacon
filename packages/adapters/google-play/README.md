# @priemskiyyy/beacon-google-play

Google Play for [Beacon](../../core), as two routes for two needs. `playStore` opens the Play Store page of your app, with no native code of your own. `googlePlay({ bridge })` maps Play's in-app updates, and **needs a native bridge you write**: no package ships one, and nothing has run it on a device. Play owns eligibility, the flows and the version order; this adapter maps what it says and claims nothing as installed until a later boot shows the running build.

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-google-play
```

## Example

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

## What it exports

| Export                                  | Does                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `playStore({ applicationId, linking })` | the store page as a route, with `openStore`; `linking` is React Native's `Linking`                                     |
| `googlePlay({ bridge })`                | in-app updates: `download`, `update` and `restart`, each flow its own command. The bridge is a native module you write |
| `GOOGLE_PLAY_DISTRIBUTION`              | `google-play`, the word a scope uses for a build published on Google Play                                              |

An accepted command is a request: Play's own UI took over, or a store page was asked for, and nothing says anything was installed.

## Learn more

[The Google Play guide](../../../docs/google-play.md) has the `PlayBridge` contract and a bridge over React Native's event emitter, what a check reports, each flow's command and receipt, and what no device has run.
