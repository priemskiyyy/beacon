# @priemskiyyy/beacon-browser

Reloading the browser document as a [Beacon](../../core) update mechanism. It requests a navigation and claims nothing more: the next document may be the same build, another one, or never arrive, and only the next boot can show what runs. It also has the pieces that let the next boot judge a reload: `webBuild`, the reader of the running web build, `webRelease`, the same build named in a source of your own, and `browserStorage`, the journal's storage in the tab.

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-browser
```

## Example

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import {
  browserReload,
  browserStorage,
  webBuild,
} from "@priemskiyyy/beacon-browser";

const beacon = new Beacon({
  scope,
  running: { web: webBuild({ id: import.meta.env.VITE_BUILD_ID }) },
  routes: {
    web: targetRoute({
      source: manifest.select((release) => release.web),
      mechanism: browserReload(),
    }),
  },
  journal: { storage: browserStorage() },
});
```

A service worker that precaches the app answers the navigation of a reload from its cache: `reload` is accepted, the page reloads into the build the worker stored, and the journal says `target-not-running`. Update through the [service worker route](../service-worker) instead, and keep the manifest out of the precache.

## What it exports

| Export                                          | Does                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browserReload({ target? })`                    | the `reload` command, for the `web` subject: it needs the offer, replaces the document and is answered `reload-requested`. `target` is the window     |
| `webBuild({ id, label?, authority?, domain? })` | the `web` reader: the build id your bundler injected, under the scope's application. An id nobody defined is unknown, never a build named `undefined` |
| `webRelease({ authority, id, label? })`         | the `Release` that `webBuild` reads back, for a source of your own such as a version file                                                             |
| `browserStorage({ area?, target?, verify? })`   | the journal's storage: `sessionStorage` by default, `area: "local"` for `localStorage`; it reads a record back after every write                      |

An accepted reload leaves the route unresolved, because the old document may stay alive: a `beforeunload` prompt can cancel it, and the application releases the route with `acknowledge()` when it does ([the recipe](../../../docs/browser.md#a-reload-the-page-cancels)).

## Learn more

[The browser guide](../../../docs/browser.md) has the running build, the build in a source of your own, the cancelled reload, the journal's storage and its failures, the back-forward cache, and what Chromium has run. [Getting started](../../../docs/getting-started.md) uses it end to end.
