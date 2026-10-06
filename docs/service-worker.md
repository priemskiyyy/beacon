---
description: "Treat a waiting service worker as an update that is ready, ask it to activate, and reload once it controls the page, without claiming which build it is."
---

# Service worker

`@priemskiyyy/beacon-service-worker` makes a service worker registration a route. A waiting worker next to one that is already active is an update that is ready. Asking it to activate is a request that proves nothing. Only a reload runs the new document. The adapter never registers, unregisters or replaces a worker.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-service-worker
```

## Create a route

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { serviceWorker } from "@priemskiyyy/beacon-service-worker";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { boot: { id: crypto.randomUUID() } },
  routes: {
    worker: serviceWorker({
      registration: () => navigator.serviceWorker.getRegistration(),
    }),
  },
});
```

The route is a driver route: the browser owns both the question and the answer, so it needs no source. It reads `navigator.serviceWorker` only when a session starts, so creating it in a server render is safe.

| Option         | Default                          | Meaning                                                    |
| -------------- | -------------------------------- | ---------------------------------------------------------- |
| `registration` | the container's own registration | a registration you hold, or a function that finds it later |
| `container`    | `navigator.serviceWorker`        | the object that announces controller changes               |
| `target`       | the global `window`              | the window a reload replaces                               |
| `message`      | `{ type: "SKIP_WAITING" }`       | what the waiting worker is sent to activate                |

The registration is yours. The route finds a registration you make after the session started, because it asks again on every check.

## What it reports

A check asks the browser to fetch the worker script again, then reads the workers.

| State of the registration                    | Route observation                                             |
| -------------------------------------------- | ------------------------------------------------------------- |
| no registration                              | `none`, detail `no-registration`                              |
| first worker installing or waiting           | `none`, detail `installing` or `first-install`                |
| a waiting worker next to an active one       | `available`: an update is ready, with the release unknown     |
| a newer worker installing                    | `none`, detail `installing`                                   |
| the worker that was active has been replaced | `prepared` is ready: the new worker controls, the page is old |

The first installation of a page is not an update. The route treats the first worker it sees active as the baseline, and `prepared` becomes ready only when that worker has been replaced, because a skip-waiting request alone proves no activation.

The release is unknown because the bytes behind a script URL can change. Without an identity handshake the interface can say that an update is ready and nothing more. The offer carries `worker: { id }`, a number that names one observed worker instance.

## Commands

| Command    | Needs      | Impact                 | Binding            | Receipt                |
| ---------- | ---------- | ---------------------- | ------------------ | ---------------------- |
| `activate` | an offer   | `worker-takeover`      | `exact-instance`   | `activation-requested` |
| `reload`   | a prepared | `document-replacement` | `provider-current` | `reload-requested`     |

```ts
import { beacon } from "src/beacon";

const route = beacon.route("worker");
const { observation } = route.state.get();

if (observation.status === "available") {
  const outcome = await route.activate({ offer: observation.offer.ref });

  console.info(outcome.status);
}
```

`activate` posts the message to the worker the offer is about. If that worker is no longer the waiting one, the command settles as `stale`. If no worker is registered, it settles as `unsupported` with `no-registration`. Once the session ended, it is `cancelled` and nothing is posted.

An accepted `activate` says the worker was asked to skip waiting, and nothing else. Wait for the route to say the takeover happened, and then reload:

```ts
import { beacon } from "src/beacon";

const stop = beacon.route("worker").state.subscribe(async () => {
  const route = beacon.route("worker");
  const { prepared } = route.state.get();

  if (prepared.status !== "ready") {
    return;
  }

  stop();
  await route.reload({ prepared: prepared.value.ref });
});
```

## What the worker must do

The worker must implement the protocol. Without a handler nothing happens, and nothing is reported as activated.

```js
// sw.js
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
```

## Every tab

Activation is a takeover of every tab of the scope. One tab's guard cannot certify the others, and this release coordinates no other tab. A participant in this tab can block the takeover from this tab only. See [disruptions](disruptions.md) and [limits](limits.md).

## A page restored from the back-forward cache

While a page is frozen, the browser can change the workers without telling it. When the page is shown again, start the session again. The route reads the registration once more, so the controller and the document are reconciled independently, and an offer from before the freeze is refused as stale instead of being replayed against a worker that is no longer waiting.

```ts
import { beacon } from "src/beacon";

addEventListener("pageshow", (event) => {
  if (!event.persisted) {
    return;
  }

  beacon.stop();
  beacon.start();
});
```

## Not built yet

A Workbox profile, and the identity handshake that would let a worker say which build it is. Until then the route reports an update as ready with an unknown build. See [decisions](decisions.md).
