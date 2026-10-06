# @priemskiyyy/beacon-app-store

App Store metadata and store handoff for [Beacon](../../core), as two separate capabilities: an advisory marketing-release source, and a mechanism that opens the store page. Neither installs anything, and a marketing version is never presented as the exact native build a device will receive.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-app-store
```

## Create a route

```ts
import { Beacon, newerRoute } from "@priemskiyyy/beacon";
import {
  appleMarketingVersion,
  appleVersion,
  appStoreHandoff,
  appStoreLookup,
} from "@priemskiyyy/beacon-app-store";
import { Linking } from "react-native";

const store = appStoreLookup({
  appId: APP_STORE_ID, // the numeric id
  country: "de", // your lookup storefront, never derived from the device
  bundleId: "com.example.notes",
  request: async ({ url, signal }) =>
    parseLookup(await (await fetch(url, { signal })).json()),
});

const binary = newerRoute({
  subject: "native",
  source: store.select((document) => document.decision),
  version: appleVersion(),
  current: appleMarketingVersion,
  mechanism: appStoreHandoff({ appId: APP_STORE_ID, linking: Linking }),
});
```

`request` is your client call: it owns the transport and validates the response into `{ results }`, so a rate limit, a blocked request or an HTML page is yours to throw. The source then checks that the entry is your app and bundle, and refuses several entries, another app, a missing version or a malformed date, each with its own message.

## What it reports

| Lookup                       | Route observation                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| a newer marketing version    | `available`, with the release date as advisory metadata                               |
| the same or an older version | `none`                                                                                |
| no entry                     | `none`, detail `no-match`: nothing matched in that storefront only                    |
| no `shortVersion` running    | `inconclusive`: nothing claims a newer version without knowing the order of what runs |

The running native release keeps `CFBundleShortVersionString` as `raw.shortVersion` and the build number as a separate fact; `appleMarketingVersion` reads the first. A marketing version can never satisfy a build-level minimum.

## Handoff

`openStore` takes an offer or none, since remediation can send a user to the store without one. It opens `https://apps.apple.com/app/id<appId>`, built from your configured id alone and never from a manifest. A resolved call means only that the OS accepted the request: the user can decline or never return, and the route settles as soon as it is accepted, without waiting for the app to come back.

TestFlight, enterprise and development builds are not App Store distributions: configure the route only where it applies.
