# @priemskiyyy/beacon-app-store

The App Store page of your app as a [Beacon](../../core) route: Apple's lookup as an advisory marketing-release source, and a handoff that opens the store page. Neither installs anything, and a marketing version is never presented as the exact native build a device will receive.

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-app-store
```

## Example

```ts
import { Beacon } from "@priemskiyyy/beacon";
import {
  APP_STORE_DISTRIBUTION,
  appStore,
} from "@priemskiyyy/beacon-app-store";
import { expoApplication } from "@priemskiyyy/beacon-expo";
import * as Application from "expo-application";
import { Linking } from "react-native";

const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "ios",
    distribution: APP_STORE_DISTRIBUTION,
  },
  running: { native: expoApplication({ application: Application }) },
  routes: {
    binary: appStore({
      appId: APP_STORE_ID, // the numeric id
      country: "de", // your lookup storefront, never derived from the device
      bundleId: "com.example.notes",
      linking: Linking,
    }),
  },
});

await beacon.route("binary").openStore();
```

Both halves of the route answer only for the `app-store` distribution: a lookup for a scope that says another makes no request and has no release to offer, and `openStore` is `unsupported` with the reason `other-distribution` and opens nothing. A resolved `openStore` means only that the OS accepted the request.

## Options

| `appStore` option | Meaning                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `appId`           | the numeric App Store id of your app                                                                                    |
| `country`         | the storefront the lookup asks, such as `de`                                                                            |
| `bundleId`        | when given, the entry the lookup finds must carry it                                                                    |
| `linking`         | the platform's link opener: React Native's `Linking`                                                                    |
| `fetch`           | a lookup client of your own; the global `fetch` by default, whose response cannot say it was redirected on React Native |

`appStoreLookup`, `appleVersion`, `appleMarketingVersion` and `appStoreHandoff` stay exported for an application that composes its own route with `newerRoute`.

## Learn more

[The App Store guide](../../../docs/app-store.md) has what a check reports, the handoff, the distributions the store adapters agree on and what the lookup refuses. [React Native](../../../docs/react-native.md#stop-a-build-that-is-too-old) uses it in a forced-upgrade screen.
