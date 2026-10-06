---
description: "Reload the browser document as a Beacon update mechanism, read the running web build from the id your bundler injects, and keep the journal in the tab's web storage, with server rendering and back-forward cache notes."
---

# Browser

`@priemskiyyy/beacon-browser` reloads the document. It requests a navigation and claims nothing more. The next document may be the same build, another one, or never arrive, and only the next boot can show what runs. It also has the two pieces that make a reload something the next boot can judge: `webBuild` reads the running build, and `browserStorage` keeps the journal in the tab.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-browser
```

## Create a route

`browserReload()` is a mechanism, so it goes into a feed route. The source says what the deployment should run, and the mechanism carries the reload.

```ts
import { Beacon, createBootId, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseSource,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";

declare const manifest: ReleaseSource<{ web: TargetDecision | NoneDecision }>;
declare const __BUILD_ID__: string;

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: {
    boot: { id: createBootId() },
    web: webBuild({ authority: "com.example.notes", id: __BUILD_ID__ }),
  },
  routes: {
    web: targetRoute({
      subject: "web",
      source: manifest.select((document) => document.web),
      mechanism: browserReload(),
    }),
  },
});
```

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

  console.info(outcome.status);
}
```

## What an accepted reload means

Nothing about which build runs next. The reload is bound to no build: if the deployment changed again between the check and the navigation, the new document runs that build. The offer named the release the user was shown, and the running fact of the next boot is the only truth.

An accepted reload also leaves the route unresolved. The old document may stay alive, because a `beforeunload` handler can cancel the navigation, so the reservations of your participants are kept and the next command is blocked with `operation-indeterminate`. Call `route.acknowledge()` once the application decides to continue in this runtime.

With the [journal](journal.md) on, the intent is written before the reload, and the next boot learns whether it ran the target, ran what ran before, or ran something else.

## Options

`browserReload({ target })` reloads the document of `target`, the global `window` by default. `target` is anything with `location.reload()`, so a frame or a test double works.

```ts
import { browserReload } from "@priemskiyyy/beacon-browser";

export const parent = browserReload({ target: window.parent });
```

The mechanism opens with a session and reads the global `window` only then, so creating it in a server render touches nothing. Without a window, opening does nothing, `native.window` is `null`, and `reload` settles as `unsupported` with the reason `no-document`.

`route.native` exposes `{ window }` while a session is open. Reloading it directly bypasses Beacon's admission and journal.

## What the running fact must say

`webBuild` is the `web` reader. It reads the build the document was loaded from, the id your bundler writes into the code, such as `import.meta.env.VITE_BUILD_ID` in Vite or `process.env.NEXT_PUBLIC_BUILD_ID` in Next.js. Its identity must use the same `authority` and `domain` as the manifest's release, or the two are incomparable and the route says `inconclusive`. Never read it from the manifest: the point is to compare the running build with what an authority wants.

| Option      | Meaning                                                                           |
| ----------- | --------------------------------------------------------------------------------- |
| `authority` | who assigns the build ids, which is `scope.application`                           |
| `id`        | the constant the bundler injected, as `string`, `null` or `undefined`             |
| `label`     | a name for people, the id by default                                              |
| `domain`    | what the ids name, `web-artifact` by default, the word the standard manifest uses |

<!-- snippet: fragment -->

```ts
import { webBuild } from "@priemskiyyy/beacon-browser";

export const web = webBuild({
  authority: "com.example.notes",
  id: import.meta.env.VITE_BUILD_ID,
});
```

A constant nobody defined is not a build. An unset `import.meta.env.VITE_BUILD_ID` compiles to `undefined` (Vite 8 writes `void 0`), an empty define to an empty string, and one written into a string to the text `undefined`. Each makes the identity unknown, with the reason `build-id-not-injected`, and never a known build named `undefined`: the journal then says `inconclusive`, and a route against it says `inconclusive` too. An `authority` or a `domain` that is empty or has a space around it is refused when the reader is made, with `INVALID_CONFIGURATION`. It asks the document for nothing, so creating it in a server render is harmless.

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
