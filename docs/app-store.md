---
description: "Read App Store metadata as an advisory marketing-release source, order Apple marketing versions, and hand the user to the store page, without claiming an installation."
---

# App Store

`@priemskiyyy/beacon-app-store` offers two separate capabilities: an advisory source of marketing releases, and a mechanism that opens the store page. Neither installs anything. A marketing version is never presented as the exact native build a device will receive.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-app-store
```

## Create a route

```ts
// src/beacon.ts
import { Beacon, newerRoute } from "@priemskiyyy/beacon";
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

// The running build, from your native constants.
declare const nativeBuild: { shortVersion: string; buildNumber: string };

const store = appStoreLookup({
  appId: "284882215",
  country: "de",
  bundleId: "com.example.notes",
  fetch: async ({ url, signal }) =>
    parseLookup(await (await fetch(url, { signal })).json()),
});

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "ios",
    distribution: "app-store",
  },
  running: {
    boot: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    native: () => ({
      identity: {
        status: "known",
        authority: "com.example.notes",
        domain: "ios-build",
        value: nativeBuild.buildNumber,
      },
      label: nativeBuild.shortVersion,
      raw: {
        shortVersion: nativeBuild.shortVersion,
        buildNumber: nativeBuild.buildNumber,
      },
    }),
  },
  routes: {
    binary: newerRoute({
      subject: "native",
      source: store.select((document) => document.decision),
      version: appleVersion(),
      current: appleMarketingVersion,
      mechanism: appStoreHandoff({ appId: "284882215", linking: Linking }),
    }),
  },
});
```

The lookup and the handoff are separate. The route joins them: `newerRoute` selects a candidate from the source and carries the `openStore` command of the mechanism.

## The lookup source

`appStoreLookup` reads Apple's published lookup shape through your client. `fetch` receives the documented lookup URL for your app and storefront, and a signal. It owns the transport and validates the response into `{ results }`, so a rate limit, a blocked request or an HTML page is yours to throw.

| Option     | Rule                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| `appId`    | the numeric App Store id, as text of digits; anything else throws `INVALID_CONFIGURATION` |
| `country`  | your lookup storefront as two lowercase letters, never derived from the device            |
| `bundleId` | optional; when given, the entry's bundle must match                                       |
| `name`     | optional label for diagnostics, `app-store-lookup` by default                             |

The device's physical country does not establish its account storefront, so the storefront is your configuration.

The source then checks that the entry is your app. It refuses several entries, another app id, another bundle id, a missing version and a malformed release date, each with `SOURCE_FAILED` and its own message. It never repairs a response into an answer.

| Lookup                          | Route observation                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| a newer marketing version       | `available`, with the release date as advisory metadata                               |
| the same or an older version    | `none`                                                                                |
| no entry                        | `none`, detail `no-match`: nothing matched in that storefront only                    |
| a scope that is not `app-store` | `none`, detail `other-distribution`, with no request                                  |
| no `shortVersion` running       | `inconclusive`: nothing claims a newer version without knowing the order of what runs |

The candidate is named by the marketing version, under your application id as authority and the domain `apple-marketing-version`. Its metadata is `{ releasedAt }` in epoch milliseconds. The source carries no expiry, so each check asks again.

## Marketing versions

`appleVersion()` is the version strategy of the store: one to three numbers, with the missing ones zero, so `3.2` equals `3.2.0`. Anything else, such as `3.2.1-beta`, breaks the grammar and throws `INVALID_VERSION`.

`appleMarketingVersion` is the `current` function that reads the order of what runs. It takes the `shortVersion` fact of the running native release, which holds `CFBundleShortVersionString`, and answers `null` when there is none. The build number stays a separate fact.

A marketing version orders marketing releases only. It can never satisfy a build-level minimum: a policy about `CFBundleVersion` reads the build number, not this. See [support](support.md#a-minimum-native-build).

## Handoff

`appStoreHandoff({ appId, linking })` is a mechanism with one command, `openStore`. It takes an offer or none, because remediation can send a user to the store without one.

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

| Declared     | Value                    |
| ------------ | ------------------------ |
| reference    | an optional offer        |
| `impacts`    | `external-handoff`       |
| `binding`    | `store-destination`      |
| receipt kind | `store-handoff-accepted` |

It opens `https://apps.apple.com/app/id<appId>`, built from your configured id alone and never from a manifest. A resolved call means only that the OS accepted the request. The user can decline or never return, and the route settles as soon as it is accepted, without waiting for the app to come back. Nothing says an installation began.

`linking` is anything with `openURL(url)`, so React Native's `Linking` fits and a test passes a fake.

## TestFlight, enterprise and development builds

They are not App Store distributions. The distribution is your configuration. A lookup read for a scope whose `distribution` is not `app-store` makes no request and has no release to offer, and the route is yours to leave out where it does not apply.

A required native update with no usable route is a support state to handle, not a reason to redirect to the store again and again. See [support](support.md#when-support-ends).
