# @priemskiyyy/beacon-service-worker

A service worker registration as a [Beacon](../../core) route. A waiting worker next to one that is already active is an update that is ready; asking it to activate is a request that proves nothing; and only a reload runs the new document. The adapter never registers, unregisters or replaces a worker.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-service-worker
```

## Create a route

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { serviceWorker } from "@priemskiyyy/beacon-service-worker";

const beacon = new Beacon({
  scope,
  routes: { worker: serviceWorker() },
});
```

The route reads `navigator.serviceWorker` only when a session starts, so creating it in a server render is safe. Pass `registration` to use a registration you already hold, or a function that finds it later, and `container`, `target` or `message` to use another container, window or skip-waiting message.

## What a check reports

| What the page has                                                            | Route observation                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| a container with no registration                                             | `none`, detail `no-registration`                              |
| first worker installing or waiting                                           | `none`, detail `installing` or `first-install`                |
| a newer worker installing                                                    | `none`, detail `installing`                                   |
| a waiting worker next to an active one                                       | `available`: an update is ready, with the release unknown     |
| the worker that was active has been replaced                                 | `prepared` is ready: the new worker controls, the page is old |
| no service workers on the page, as in a server render or an insecure context | `unknown`, an environment that cannot check, never `none`     |

The release is unknown because the bytes behind a script URL can change: without an identity handshake the UI can say that an update is ready and nothing more.

## Commands

| Command    | Needs      | Impact                 | Binding            | Receipt                |
| ---------- | ---------- | ---------------------- | ------------------ | ---------------------- |
| `activate` | an offer   | `worker-takeover`      | `exact-instance`   | `activation-requested` |
| `reload`   | a prepared | `document-replacement` | `provider-current` | `reload-requested`     |

`activate` posts `{ type: "SKIP_WAITING" }`, or your `message`, to the worker the offer is about. The worker must implement that protocol and claim its clients; without a handler nothing happens, and nothing is reported as activated. Activation reaches every tab of the scope: one tab's guard cannot certify the others.

## A page restored from the back-forward cache

While a page is frozen the browser can change the workers without telling it. When the page is shown again, start the session again: the route reads the registration once more, so the controller and the document are reconciled independently, and an offer from before the freeze is refused as stale instead of being replayed against a worker that is no longer waiting.

```ts
addEventListener("pageshow", (event) => {
  if (!event.persisted) {
    return;
  }

  beacon.stop();
  beacon.start();
});
```

## What it does not do

It names no build: the release of an update stays unknown, and nothing is claimed as activated until the route says the takeover happened. It registers, unregisters and replaces no worker, and it coordinates no other tab.
