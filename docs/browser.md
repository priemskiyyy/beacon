---
description: "Reload the browser document as a Beacon update mechanism, read the running web build from the id your bundler injects, name the build in a source of your own, and keep the journal in the tab's web storage, with the cancelled reload, service worker and back-forward cache notes."
---

# Browser

`@priemskiyyy/beacon-browser` reloads the document. It requests a navigation and claims nothing more. The next document may be the same build, another one, or never arrive, and only the next boot can show what runs. It also has the pieces that make a reload something the next boot can judge: `webBuild` reads the running build, `webRelease` names that build in a source of your own, and `browserStorage` keeps the journal in the tab.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-browser
```

## Create a route

`browserReload()` is a mechanism, so it goes into a feed route. The source says what the deployment should run, and the mechanism carries the reload. It names the `web` subject, so the route compares the offer with the `web` reader.

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseSource,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";

declare const manifest: ReleaseSource<{ web: TargetDecision | NoneDecision }>;

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: {
    web: webBuild({ id: import.meta.env.VITE_BUILD_ID }),
  },
  routes: {
    web: targetRoute({
      source: manifest.select((document) => document.web),
      mechanism: browserReload(),
    }),
  },
});
```

::: warning Do you ship a service worker that precaches the app?
A worker that precaches the app shell (Workbox, and `vite-plugin-pwa` by default) answers the navigation of a reload from its cache. `reload` is accepted, the page reloads into the build the worker stored, the banner comes back, and the journal says `target-not-running`. A Chromium run with such a worker shows exactly that. `browserReload` reloads a document and cannot change which document the worker serves, so an app with a precaching worker updates through the [service worker route](service-worker.md): it activates the waiting worker and reloads once that worker controls the page. Keep the manifest out of the precache too, or it reports the build the worker installed with.
:::

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
    .reload({ offer: observation.offer });

  console.info(outcome.status);
}
```

## What an accepted reload means

Nothing about which build runs next. The reload is bound to no build: if the deployment changed again between the check and the navigation, the new document runs that build. The offer named the release the user was shown, and the running fact of the next boot is the only truth.

An accepted reload also leaves the route unresolved. The old document may stay alive, because a `beforeunload` handler can cancel the navigation, so the reservations of your participants are kept and the next command is blocked with `operation-indeterminate`. Call `route.acknowledge()` once the application decides to continue in this runtime.

With the [journal](journal.md) on, the intent is written before the reload, and the next boot learns whether it ran the target, ran what ran before, or ran something else.

## A reload the page cancels

A `beforeunload` handler can stop the navigation: the user chooses to stay, the page lives on, and `reload` had already answered `accepted`. The route is unresolved, since a reload that may have taken effect is never retried blindly, so it keeps your participants closed and the next command is blocked with `operation-indeterminate`. A guard that locked a draft for the reload keeps it locked. Nothing tells Beacon the navigation was cancelled, because nothing tells the page either: the browser fires no event for a stay. What it does is stop the page's timers while the prompt is open, so a timer armed from the handler runs once the prompt is answered. Acknowledge from it:

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

The check matters: without it the timer runs in every reload, the route is released while the new document is still loading, and the old page lets the user type into a draft that is about to go. With it only a page that asked for a prompt acknowledges. A guard written with `event.preventDefault()` and one written with `event.returnValue = "..."` are both seen. The timer also runs when the user chooses to leave, for the moment the navigation takes: the route is released and the page is replaced anyway, which costs nothing the prompt did not warn of.

Chromium shows this with a real prompt: a dismissed prompt leaves the route `indeterminate` and the draft locked without the handler, and with it the route is `idle` and typing works again, while a reload nobody prompts about stays closed until the new document replaces the old one. Firefox and Safari are not run. Where you would rather not rely on it, show a "Stay on this page" button that calls `acknowledge()`. `browserReload` does not report a cancelled navigation itself: the application owns this, since only it knows it asked for a prompt.

## Options

`browserReload({ target })` reloads the document of `target`, the global `window` by default. `target` is anything with `location.reload()`, so a frame or a test double works.

```ts
import { browserReload } from "@priemskiyyy/beacon-browser";

export const parent = browserReload({ target: window.parent });
```

The mechanism opens with a session and reads the global `window` only then, so creating it in a server render touches nothing. Without a window, opening does nothing, `native.window` is `null`, and `reload` settles as `unsupported` with the reason `no-document`.

`route.native` exposes `{ window }` while a session is open. Reloading it directly bypasses Beacon's admission and journal.

## What the running fact must say

`webBuild` is the `web` reader. It reads the build the document was loaded from, the id your bundler writes into the code, such as `import.meta.env.VITE_BUILD_ID` in Vite or `process.env.NEXT_PUBLIC_BUILD_ID` in Next.js. Its identity must use the same `authority` and `domain` as the manifest's release, or the two are incomparable and the route says `inconclusive`. The authority is the application of the scope, which the reader is given each time it runs, so `webBuild({ id })` is all it takes. Never read it from the manifest: the point is to compare the running build with what an authority wants.

| Option      | Meaning                                                                           |
| ----------- | --------------------------------------------------------------------------------- |
| `authority` | who assigns the build ids: `scope.application`, unless you give another           |
| `id`        | the constant the bundler injected, as `string`, `null` or `undefined`             |
| `label`     | a name for people, the id by default                                              |
| `domain`    | what the ids name, `web-artifact` by default, the word the standard manifest uses |

<!-- snippet: fragment -->

```ts
import { webBuild } from "@priemskiyyy/beacon-browser";

export const web = webBuild({ id: import.meta.env.VITE_BUILD_ID });
```

A constant nobody defined is not a build. An unset `import.meta.env.VITE_BUILD_ID` compiles to `undefined` (Vite 8 writes `void 0`), an empty define to an empty string, and one written into a string to the text `undefined`. Each makes the identity unknown, with the reason `build-id-not-injected`, and never a known build named `undefined`: the journal then says `inconclusive`, and a route against it says `inconclusive` too. An `authority` or a `domain` that is given and is empty or has a space around it is refused when the reader is made, with `INVALID_CONFIGURATION`. It asks the document for nothing, so creating it in a server render is harmless.

## Name the build in a source of your own

The standard manifest of [HTTP](http.md) names a build as a text, and a source of your own, such as a version file, has to name it the same way `webBuild` reads it. `webRelease({ authority, id, label })` makes that release, so no identity is written by hand and the words cannot drift from the reader's.

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import { browserReload, webRelease } from "@priemskiyyy/beacon-browser";
import { http } from "@priemskiyyy/beacon-http";

const versionFile = http<{ build: string }>({
  fetch: async ({ signal }) => {
    const response = await fetch("/version.json", { signal });

    return { document: await response.json() };
  },
});

export const web = targetRoute({
  source: versionFile.select((file) => ({
    kind: "target",
    release: webRelease({ authority: "com.example.notes", id: file.build }),
  })),
  mechanism: browserReload(),
});
```

`authority` is the `scope.application` that `webBuild` names the running build under, and it is spelled out here because a `select` is given the document and not the scope. `id` is the build the file says should run. The id is read as `webBuild` reads it, so a padded one is the same build. A release is an authority's claim and cannot be unknown: an id that is empty or is the text of a missing define, such as `undefined`, throws `INVALID_CONFIGURATION`, which a `select` turns into a failed check, never into an offer of a build named `undefined`.

## Journal storage

A reload replaces the document, and the journal keeps what the old one asked for in storage that survives it. `browserStorage()` keeps it in the tab's `sessionStorage`.

```ts
import type { JournalOptions } from "@priemskiyyy/beacon";
import { browserStorage } from "@priemskiyyy/beacon-browser";

export const journal = {
  mode: "required",
  storage: browserStorage(),
} satisfies JournalOptions;
```

| Option   | Meaning                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `area`   | `session` by default: the next boot after `location.reload()` is the same tab, which reads what this one wrote, and no other tab can overwrite it. `local` is shared by every tab, so a fresh tab judges another tab's intent, and the last write wins |
| `target` | the window whose storage is used, the global `window` by default                                                                                                                                                                                       |
| `verify` | reads the record back after a write, on by default, as `keyValueJournalStorage` does                                                                                                                                                                   |

It is built on `keyValueJournalStorage` and reaches the storage at each call, never at creation. A server render, where there is no window, rejects the call with its own error. A frame that blocks site data, where reading the storage property throws a `SecurityError`, rejects it with that error as the `cause`. A full storage rejects the write with the browser's own `QuotaExceededError`. A `required` journal stops the reload on each of them, and a `best-effort` one goes on and says `degraded`. A spec runs all of this in Chromium with a real reload (`examples/browser-storage.spec.ts`). Private browsing modes, the eviction of site data and the other browsers are not run: see [the journal](journal.md#choosing-a-storage).

## A page restored from the back-forward cache

A page the browser kept and shows again is the same boot. Nothing loaded, so nothing reports an update boot. When it comes back, release the reload that was requested and start the session again. That reads what runs once more, and reconciles without a new boot id.

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

Handling of BFCache restoration beyond this, and reload recovery for a stale chunk, are not built yet; see [decisions](decisions.md).

## What it does not do

- It does not cache-bust, unregister a service worker or clear storage.
- It does not guard navigations that something else starts. A link, the operating system or the user can leave the page without asking Beacon; see [limits](limits.md).
- It does not check that a new document arrived. Only a boot shows what runs.

For an application with a service worker, see [service worker](service-worker.md): a waiting worker is a different kind of update, with a different route.
