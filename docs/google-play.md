---
description: "Map Google Play in-app updates onto a Beacon route over a native bridge you inject: the flows, the download, update and restart commands, and what a fake bridge cannot prove."
---

# Google Play

`@priemskiyyy/beacon-google-play` makes Play's in-app updates a route, over a native bridge you inject. Play owns eligibility, the flows and the version order. The adapter maps what it says and claims nothing as installed until a later boot shows the running build.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-google-play
```

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

## Create a route

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import { NativeModules } from "react-native";

const bridge: PlayBridge = NativeModules.PlayUpdates;

export const beacon = new Beacon({
  // scope.application is the Android application id.
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: "google-play",
  },
  running: {
    boot: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
  },
  routes: { binary: googlePlay({ bridge }) },
});
```

The route is a driver route on the `native` subject. A bridge belongs to one open session at a time: a second Beacon that opens a route on the same bridge fails to open it, and that route says `DRIVER_FAILED`.

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

An update Play reports as already downloaded is prepared when the app starts, without any command, and a download finishing while the app runs prepares it too. The prepared target is `flexible`. Progress comes from Play's own byte counts, `null` when Play gave none, and a total is never invented.

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
    const download = await route.download({ offer: offer.ref });

    if (download.status !== "accepted") {
      return download.status;
    }

    const { prepared } = route.state.get();

    if (prepared.status !== "ready") {
      return "nothing-prepared";
    }

    return (await route.restart({ prepared: prepared.value.ref })).status;
  }

  if (offer.flows.includes("immediate")) {
    return (await route.update({ offer: offer.ref })).status;
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
