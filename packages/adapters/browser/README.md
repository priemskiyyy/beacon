# @priemskiyyy/beacon-browser

Reloading the browser document as a [Beacon](../../core) update mechanism. It requests a navigation and claims nothing more: the next document may be the same build, another one, or never arrive, and only the next boot can show what runs. It also has the pieces that let the next boot judge a reload: `webBuild`, the reader of the running web build, `webRelease`, the same build named in a source of your own, and `browserStorage`, the journal's storage in the tab.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-browser
```

## Create a route

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import {
  browserReload,
  browserStorage,
  webBuild,
} from "@priemskiyyy/beacon-browser";

// Your bundler replaces this with the id of the build, such as the commit.
declare const BUILD_ID: string;

const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.web),
  mechanism: browserReload(),
});

const beacon = new Beacon({
  scope,
  running: {
    boot: { id: BOOT_ID },
    web: webBuild({ authority: scope.application, id: BUILD_ID }),
  },
  routes: { web },
  journal: { mode: "required", storage: browserStorage() },
});
```

> **A service worker that precaches the app** answers the navigation of a reload from its cache: `reload` is accepted, the page reloads into the build the worker stored, and the journal says `target-not-running`. Update through the [service worker route](../../../docs/service-worker.md) instead, and keep the manifest out of the precache.

## Commands

| Command  | Needs    | Impact                 | Binding               | Receipt            |
| -------- | -------- | ---------------------- | --------------------- | ------------------ |
| `reload` | an offer | `document-replacement` | `unpinned-navigation` | `reload-requested` |

`reload` needs the offer the user was shown. Participants that guard unsaved work are asked before the navigation, the next navigation receives whatever is deployed, which may not be the offer, and the receipt says only that the request was made: the running build is unchanged until a later boot says otherwise.

```ts
const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });
}
```

An accepted reload leaves the route unresolved, because the old document may stay alive: call `route.acknowledge()` once the application decides to continue in this runtime.

## Options

`browserReload({ target })` reloads the document of `target`, the global `window` by default. Without either, such as in a server render, opening does nothing, `native.window` is `null` and `reload` settles as `unsupported`.

## The running build

`webBuild({ authority, id, label, domain })` is the `web` reader. `id` is the constant your bundler writes into the code, such as `import.meta.env.VITE_BUILD_ID` or `process.env.NEXT_PUBLIC_BUILD_ID`, named under `authority` (which is `scope.application`) and the domain `web-artifact`, the words the standard manifest uses. The label is the id unless you give one. An id nobody defined is not a build: an unset define compiles to `undefined` (Vite 8 writes `void 0`), an empty one to an empty string, and one written into a string to the text `undefined`. Each makes the identity unknown, with the reason `build-id-not-injected`, never a known build named `undefined`. An `authority` or a `domain` that is empty or has a space around it is refused with `INVALID_CONFIGURATION`. It reads nothing from the document, so a server render can create and read it.

## The build in a source of your own

`webRelease({ authority, id, label })` makes the `Release` that `webBuild` reads back when that build runs, so a custom source, such as a version file, names its build without an identity written by hand:

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";
import { browserReload, webRelease } from "@priemskiyyy/beacon-browser";

declare const versionFile: ReleaseSource<{ build: string }>;

const web = targetRoute({
  subject: "web",
  source: versionFile.select((file) => ({
    kind: "target",
    release: webRelease({ authority: scope.application, id: file.build }),
  })),
  mechanism: browserReload(),
});
```

The id is read as `webBuild` reads it, and a release cannot be unknown: an empty id, or the text a missing define compiles to, throws `INVALID_CONFIGURATION`.

## A reload the page cancels

A `beforeunload` handler can stop the navigation after `reload` answered `accepted`, and the route stays unresolved, so a guard that locked a draft keeps it locked. The browser fires no event for a stay, but it stops the page's timers while the prompt is open, so a timer armed from the handler runs once it is answered:

```ts
// Registered after the application's own guard, so that it sees whether the guard asked for a prompt.
addEventListener("beforeunload", (event) => {
  // A page that asked for no prompt is leaving, and stays closed until it has.
  if (!event.defaultPrevented && event.returnValue === "") {
    return;
  }

  setTimeout(() => beacon.route("web").acknowledge(), 0);
});
```

The adapter does not report a cancelled navigation itself: the application knows it asked for a prompt. [The documentation](../../../docs/browser.md#a-reload-the-page-cancels) says what the handler costs and what it does not cover.

## The journal's storage

`browserStorage({ area, target, verify })` keeps the journal in web storage, over `keyValueJournalStorage`. The default area is `session`: `location.reload()` keeps the tab and its `sessionStorage`, so the next boot reads what this one wrote, and no other tab can overwrite it. `area: "local"` is `localStorage`, shared by every tab: a fresh tab can judge another tab's intent, and the last write wins. `target` is the window whose storage is used, the global `window` by default, and `verify` reads a record back after a write, on by default.

It reaches the storage at each call and touches nothing when it is made. A server render, where there is no window, rejects the call with its own error. A frame that blocks site data, where reading the property throws a `SecurityError`, rejects it with that error as the `cause`. A full storage rejects the write with the browser's `QuotaExceededError`. A `required` journal stops the reload on each of them, and `best-effort` goes on and says `degraded`.

## A page restored from the back-forward cache

A page the browser kept and shows again is the same boot: nothing loaded, so nothing reports an update boot. When it comes back, release the reload that was requested and start the session again, which reads what runs once more and reconciles without a new boot ID:

```ts
addEventListener("pageshow", (event) => {
  if (!event.persisted) {
    return;
  }

  beacon.route("web").acknowledge();
  beacon.stop();
  beacon.start();
});
```

## Verification

| Claim                                                                                                                                                                                                                                                                                       | Status                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The reload is a request, bound to nothing, and the intent is written before it                                                                                                                                                                                                              | Tested against a fake window                                                                                                        |
| `webBuild` follows the running-reader contract, and an id nobody defined is unknown in every spelling                                                                                                                                                                                       | Tested with `testRunningReader`, through a Beacon and its journal                                                                   |
| A real Vite 8.3 build that defines nothing, an empty id or the text `undefined` compiles to something `webBuild` calls unknown                                                                                                                                                              | Tested in Chromium 153 by `examples/browser-storage.spec.ts`, which `pnpm test:browser` runs                                        |
| A reload that a `beforeunload` prompt cancels leaves the route unresolved and the draft locked, the recipe above gives the page back for a guard written with `preventDefault` or `returnValue`, and a reload nobody prompts about stays closed until the new document replaces the old one | Tested in Chromium 153 with real prompts by `examples/browser-storage.spec.ts`, which runs the recipe as the documentation shows it |
| A service worker that precaches the page answers the reload from its cache, so the page runs the old build and the journal says the target did not run                                                                                                                                      | Tested in Chromium 153 by `examples/browser-storage.spec.ts` with a hand-written precaching worker; Workbox itself is not run       |
| `webRelease` names the build the way `webBuild` reads it, and a custom source that uses it is compared with what runs                                                                                                                                                                       | Tested through a Beacon with the mock source                                                                                        |
| `browserStorage` follows the journal-storage contract, in both areas                                                                                                                                                                                                                        | Tested with `testJournalStorage` over a Web Storage fake and over jsdom's `Storage`                                                 |
| A real `location.reload()` keeps the tab's `sessionStorage`, a new tab has none and shares `localStorage`; a full `localStorage` throws `QuotaExceededError` and stops a required reload; a sandboxed frame rejects with a `SecurityError`                                                  | Tested in Chromium 153 by `examples/browser-storage.spec.ts`, against the built package                                             |
| Safari, Firefox, the private browsing modes, the eviction of site data and intelligent tracking prevention                                                                                                                                                                                  | UNVERIFIED: needs each real browser                                                                                                 |
| The real `window` satisfies the structural types                                                                                                                                                                                                                                            | Typechecked in `browser.contracts.ts`                                                                                               |
