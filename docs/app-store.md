---
description: "Read App Store metadata as an advisory marketing-release source, order Apple marketing versions, and hand the user to the store page, without claiming an installation."
---

# App Store

`@priemskiyyy/beacon-app-store` offers two separate capabilities: an advisory source of marketing releases, and a mechanism that opens the store page. `appStore` joins them into one route. Neither installs anything. A marketing version is never presented as the exact native build a device will receive.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-app-store @priemskiyyy/beacon-native
```

`@priemskiyyy/beacon-native` reads the installed binary, which the route compares the store's version with.

## Create a route

`appStore` is the whole route: the lookup, the order of marketing versions and the handoff that opens the store page, composed for you. It takes the two numbers of your store listing, the link opener, and optionally your own lookup client.

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";

import {
  APP_STORE_DISTRIBUTION,
  appStore,
} from "@priemskiyyy/beacon-app-store";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
import { Linking } from "react-native";

const APPLICATION = "com.example.notes";

export const beacon = new Beacon({
  scope: {
    application: APPLICATION,
    environment: "production",
    platform: "ios",
    distribution: APP_STORE_DISTRIBUTION,
  },
  running: {
    native: expoApplication({
      application: Application,
      platform: "ios",
      authority: APPLICATION,
    }),
  },
  routes: {
    binary: appStore({
      appId: "284882215",
      country: "de",
      bundleId: APPLICATION,
      linking: Linking,
    }),
  },
});
```

| Option     | Rule                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `appId`    | the numeric App Store id, as text of digits; anything else throws `INVALID_CONFIGURATION`                        |
| `country`  | your lookup storefront as two lowercase letters, never derived from the device                                   |
| `bundleId` | optional; when given, the entry's bundle must match                                                              |
| `linking`  | anything with `openURL(url)`: React Native's `Linking`, or a fake in a test                                      |
| `fetch`    | optional, your own lookup client, [below](#the-lookup-source). Without it the global `fetch` asks Apple's lookup |

The route offers a marketing version newer than the one that runs, and its `openStore` opens the page of your app. The running native release is read by `expoApplication` of `@priemskiyyy/beacon-native`, or by `deviceInfo` over `react-native-device-info`, and its names are fixed so that readers and adapters agree:

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `identity.authority` | `scope.application`, the bundle id                                                     |
| `identity.domain`    | `ios-build`                                                                            |
| `identity.value`     | the build number (`CFBundleVersion`) as text                                           |
| `label`              | the marketing version (`CFBundleShortVersionString`)                                   |
| `raw`                | `applicationId`, `shortVersion` (what `appleMarketingVersion` reads) and `buildNumber` |

### One store route for both platforms

An application in both stores names one route and calls one method. `playStore` of [`@priemskiyyy/beacon-google-play`](google-play.md) opens the Play Store page with the same `openStore`, so a forced upgrade is the same call on each:

```ts
import { appStore } from "@priemskiyyy/beacon-app-store";
import { playStore } from "@priemskiyyy/beacon-google-play";
import { Linking, Platform } from "react-native";

export const createStoreRoute = () => {
  if (Platform.OS === "ios") {
    return appStore({ appId: "284882215", country: "de", linking: Linking });
  }

  return playStore({ applicationId: "com.example.notes", linking: Linking });
};

// routes: { store: createStoreRoute() }, then beacon.route("store").openStore()
```

### Compose it yourself

`appStore` is `appStoreLookup`, `appleVersion`, `appleMarketingVersion` and `appStoreHandoff` joined by `newerRoute`. They stay exported for an application that needs another piece, such as its own lookup client or its own route for the handoff:

```ts
import { newerRoute } from "@priemskiyyy/beacon";
import {
  appleMarketingVersion,
  appleVersion,
  appStoreHandoff,
  appStoreLookup,
} from "@priemskiyyy/beacon-app-store";
import type { AppStoreLookupResponse } from "@priemskiyyy/beacon-app-store";
import { Linking } from "react-native";

// Your client validates the lookup response into `{ results }`.
declare const parseLookup: (input: unknown) => AppStoreLookupResponse;

const store = appStoreLookup({
  appId: "284882215",
  country: "de",
  bundleId: "com.example.notes",
  fetch: async ({ url, signal }) =>
    parseLookup(await (await fetch(url, { signal })).json()),
});

export const binary = newerRoute({
  source: store.select((document) => document.decision),
  version: appleVersion(),
  current: appleMarketingVersion,
  mechanism: appStoreHandoff({ appId: "284882215", linking: Linking }),
});
```

The lookup and the handoff are separate. The route joins them: `newerRoute` selects a candidate from the source and carries the `openStore` command of the mechanism.

## The lookup source

`appStoreLookup` reads Apple's published lookup shape through a client. `fetch` receives the documented lookup URL for your app and storefront, and a signal. It owns the transport and validates the response into `{ results }`, so a rate limit, a blocked request or an HTML page is a failure it throws.

`appStore` brings that client with it, since Apple's lookup has one fixed shape, unlike a manifest. It asks the URL through the global `fetch` with the signal of the read, refuses a status that is not a success (`SOURCE_FAILED`, naming the status) and a response that says it was redirected, and reads the JSON into the entries with the four fields the source needs, anything else being an `INVALID_DOCUMENT`. What `fetch` throws, and a body that is not JSON, fail the read as they were thrown. React Native's `fetch` has no `redirected`, so a redirect cannot be refused there, and Apple's answer says `Cache-Control: max-age` of hours, which an iOS URL cache may honour. Pass your own `fetch` for a client that adds headers, goes through a proxy or is not the global one. With `appStoreLookup` the client is always yours, so React Native's `fetch`, which does not reject on a failing status, needs `response.ok` checked, or a validation that throws on anything that is not a lookup.

| Option     | Rule                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| `appId`    | the numeric App Store id, as text of digits; anything else throws `INVALID_CONFIGURATION` |
| `country`  | your lookup storefront as two lowercase letters, never derived from the device            |
| `bundleId` | optional; when given, the entry's bundle must match                                       |
| `name`     | optional label for diagnostics, `app-store-lookup` by default; `appStoreLookup` only      |
| `fetch`    | your client: required by `appStoreLookup`, optional for `appStore`                        |

The device's physical country does not establish its account storefront, so the storefront is your configuration.

The source then checks that the entry is your app. It refuses several entries, another app id, another bundle id, a missing version and a malformed release date, each as `INVALID_DOCUMENT`, as the [standard manifest](http.md#what-is-accepted) refuses a document that breaks its contract, and each with its own message. It never repairs a response into an answer. A failure of your client stays yours: what it throws keeps its code, and anything else is `SOURCE_FAILED`.

| Lookup                          | Route observation                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| a newer marketing version       | `available`, with the release date as advisory metadata                               |
| the same or an older version    | `none`                                                                                |
| no entry                        | `none`, detail `no-match`: nothing matched in that storefront only                    |
| a scope that is not `app-store` | `none`, detail `other-distribution`, with no request                                  |
| no `shortVersion` running       | `inconclusive`: nothing claims a newer version without knowing the order of what runs |

The candidate is named by the marketing version, under your App Store id as authority and the domain `apple-marketing-version`. Its metadata is `{ releasedAt }` in epoch milliseconds. The source carries no expiry, so each check asks again.

## Marketing versions

`appleVersion()` is the version strategy of the store: one to three numbers, with the missing ones zero, so `3.2` equals `3.2.0`. Anything else, such as `3.2.1-beta`, breaks the grammar and throws `INVALID_VERSION`.

`appleMarketingVersion` is the `current` function that reads the order of what runs. It takes the `shortVersion` fact of the running native release, which holds `CFBundleShortVersionString`, and answers `null` when there is none. The build number stays a separate fact.

A marketing version orders marketing releases only. It can never satisfy a build-level minimum: a policy about `CFBundleVersion` reads the build number, not this. See [support](support.md#a-minimum-native-build).

## Handoff

`appStoreHandoff({ appId, linking })` is a mechanism with one command, `openStore`, and `appStore` carries it. It takes an offer or none, because remediation can send a user to the store without one. It names the `native` subject, so the route compares the candidate with the `native` reader.

| Command     | Needs             | Impact             | Binding             | Receipt                   |
| ----------- | ----------------- | ------------------ | ------------------- | ------------------------- |
| `openStore` | an optional offer | `external-handoff` | `store-destination` | `store-handoff-requested` |

```ts
import { beacon } from "src/beacon";

const route = beacon.route("binary");
const { observation } = route.state.get();

if (observation.status === "available") {
  await route.openStore({ offer: observation.offer.ref });
} else {
  await route.openStore();
}
```

It opens `https://apps.apple.com/app/id<appId>`, built from your configured id alone and never from a manifest. A resolved call means only that the OS accepted the request. The user can decline or never return, and the route settles as soon as it is accepted, without waiting for the app to come back. Nothing says an installation began.

`linking` is anything with `openURL(url)`, so React Native's `Linking` fits and a test passes a fake. On iOS `Linking.openURL` resolves once the system opened the URL and rejects when it could not, which becomes a failed command, `COMMAND_FAILED`, and never an accepted one.

## TestFlight, enterprise and development builds

They are not App Store distributions. The distribution is your configuration, and the store adapters agree on three words for it:

| Distribution  | For                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `app-store`   | a build the App Store serves. `@priemskiyyy/beacon-app-store` exports it as `APP_STORE_DISTRIBUTION` |
| `google-play` | a build Google Play serves. `@priemskiyyy/beacon-google-play` exports `GOOGLE_PLAY_DISTRIBUTION`     |
| `development` | a build in neither, such as a debug build or a simulator                                             |

A TestFlight or enterprise build is yours to name, since neither store route is for it.

Both halves of the route answer only for `app-store`. A lookup read for a scope whose `distribution` is another makes no request and has no release to offer, and `openStore` is `unsupported` with the reason `other-distribution` and opens nothing, so a build outside the store is never sent to it, whatever asked: a support policy's remediation included. The route is yours to leave out where it does not apply.

A required native update with no usable route is a support state to handle, not a reason to redirect to the store again and again. See [support](support.md#when-support-ends).
