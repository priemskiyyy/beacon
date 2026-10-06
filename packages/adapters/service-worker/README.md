# @priemskiyyy/beacon-service-worker

A service worker registration as a [Beacon](../../core) route. A waiting worker next to one that is already active is an update that is ready; asking it to activate is a request that proves nothing; and only a reload runs the new document. The adapter never registers, unregisters or replaces a worker. An app whose worker precaches the app shell needs it, since `browserReload` alone reloads the cached build.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-service-worker
```

## Example

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { serviceWorker } from "@priemskiyyy/beacon-service-worker";

const beacon = new Beacon({
  scope,
  routes: { worker: serviceWorker() },
});
```

The route reads `navigator.serviceWorker` only when a session starts, so creating it in a server render is safe. The release of a waiting worker is unknown, since the bytes behind a script URL can change: say that an update is ready, and nothing more.

## Options and commands

| Option         | Meaning                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| `registration` | a registration you hold, or a function that finds it later; the container's own by default |
| `container`    | the container that announces controller changes, `navigator.serviceWorker` by default      |
| `target`       | the window a reload replaces, the global `window` by default                               |
| `message`      | what the worker listens for to skip waiting, `{ type: "SKIP_WAITING" }` by default         |

| Command    | Needs      | Impact                 | Receipt                |
| ---------- | ---------- | ---------------------- | ---------------------- |
| `activate` | an offer   | `worker-takeover`      | `activation-requested` |
| `reload`   | a prepared | `document-replacement` | `reload-requested`     |

The worker must implement the skip-waiting message and claim its clients, or nothing happens. Activation reaches every tab of the scope: one tab's guard cannot certify the others.

## Learn more

[The service worker guide](../../../docs/service-worker.md) has what a check reports, the activation and reload steps in React, the back-forward cache and what it does not do.
