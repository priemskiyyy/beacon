---
description: "Map Expo Updates onto a Beacon route: what a check reports, the download and reload commands, their receipts, and what expo-updates keeps to itself."
---

# Expo

`@priemskiyyy/beacon-expo` makes Expo Updates a route. Discovery, eligibility, asset fetching, verification and startup selection stay with `expo-updates`. The adapter maps what the SDK says in full and claims nothing as running until a later boot shows it.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-expo expo-updates
```

## Create a route

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: "store",
  },
  running: {
    boot: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    bundle: expoBundle(Updates),
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

## What a check reports

| SDK result                              | Route observation                                         |
| --------------------------------------- | --------------------------------------------------------- |
| an available update                     | `available`, named by the id its server assigned          |
| a rollback to the embedded update       | `available` as a rollback, with an identity nobody named  |
| a valid answer with neither             | `none`, with the SDK's own reason as the detail           |
| a rejection                             | the check fails and the last observation stays            |
| updates disabled (development, Expo Go) | `unknown`, an environment that cannot check, never `none` |

The offer carries `kind`: `update` or `rollback-to-embedded`. A rollback has an unknown identity with the reason `embedded-rollback`, since the SDK does not name the embedded update.

## Commands

| Command    | Needs      | Impact                       | Binding            | Receipt                                                      |
| ---------- | ---------- | ---------------------------- | ------------------ | ------------------------------------------------------------ |
| `download` | an offer   | `may-activate-on-next-start` | `provider-current` | `update-prepared`, `rollback-prepared`, `no-new-preparation` |
| `reload`   | a prepared | `javascript-restart`         | `provider-current` | `reload-requested`                                           |

Both are `unsupported` with the reason `updates-disabled` while updates are off.

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

`prepared` starts at `unknown` and becomes `ready` only through a `download` of this session. Autonomous downloads that `expo-updates` runs on its own are not observed.

## What it does not do

Autonomous checks and downloads that `expo-updates` runs at startup are not observed: this is the command profile. A hook bridge over `useUpdates()` is not part of this release. A stable claim needs a real device with a real update server; the adapter is typechecked against the real SDK types and tested against a fake. See [verification](verification.md).
