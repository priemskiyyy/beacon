# @priemskiyyy/beacon

Release awareness and update coordination for React and React Native apps. One `Beacon` keeps what your app is running, what its release authorities want and which provider actions can be requested, and never claims an installation nobody observed. It has no dependencies, no timer and subscribes to nothing until you start a session.

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon
```

An app adds [`@priemskiyyy/beacon-react`](../react) and the adapters it uses: [`beacon-expo`](../adapters/expo) for an Expo app, [`beacon-http`](../adapters/http) and [`beacon-browser`](../adapters/browser) for the web.

## Example

```ts
import { Beacon } from "@priemskiyyy/beacon";

const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { web: readWebRelease },
  routes: { web },
});

const stop = beacon.start();

await beacon.check();

const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  await beacon.route("web").reload({ offer: observation.offer });
}
```

A route has a state in four dimensions that never rewrite each other: the latest **check**, the accepted **observation**, what the provider has **prepared**, and the running **operation**. Every command settles as a status and never rejects, and an accepted one is a request, never an installation.

## What it exports

| Export                                                  | Is                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Beacon`                                                | the session, the routes, the running facts, the support state, the journal and the disruptions                   |
| `targetRoute`, `newerRoute`                             | a route over a release source and an update mechanism: a deployment's target, or a release that is newer         |
| `minimumBuild`, `supportPolicy`                         | the forced upgrade in one call, and a policy of your own                                                         |
| `keyValueJournalStorage`, `createBootId`, `BeaconError` | the journal over a key-value store, the boot id Beacon mints for you, and the error that misconfiguration throws |
| `@priemskiyyy/beacon/triggers`, `/triggers/browser`     | `checkOn` with `foreground`, `reconnect`, `interval` and the gate behind them, for React Native and the web      |
| `@priemskiyyy/beacon/versions`                          | `semver`, `integer` and `custom`, the version strategies                                                         |
| `@priemskiyyy/beacon/adapter`                           | what an adapter author writes: `createReleaseSource`, `createUpdateMechanism`, `createReleaseDriver`             |
| `@priemskiyyy/beacon/mock`, `/testing`                  | the mocks and the conformance suites for your tests (`/testing` needs `vitest`)                                  |

## Learn more

[Getting started](../../docs/getting-started.md) is the web path and [React Native](../../docs/react-native.md) the Expo one. [The mental model](../../docs/mental-model.md) names the vocabulary, [routes](../../docs/routes.md), [commands](../../docs/commands.md), [support](../../docs/support.md), [the journal](../../docs/journal.md) and [scopes](../../docs/scopes.md) are the concepts, and [the API](../../docs/api.md) lists every export.
