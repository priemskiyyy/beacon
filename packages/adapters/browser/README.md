# @priemskiyyy/beacon-browser

Reloading the browser document as a [Beacon](../../core) update mechanism. It requests a navigation and claims nothing more: the next document may be the same build, another one, or never arrive, and only the next boot can show what runs.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-browser
```

## Create a route

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";

const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.web),
  mechanism: browserReload(),
});

const beacon = new Beacon({
  scope,
  running: { boot: { id: BOOT_ID }, web: readWebRelease },
  routes: { web },
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
}
```

An accepted reload leaves the route unresolved, because the old document may stay alive: call `route.acknowledge()` once the application decides to continue in this runtime.

## Options

`browserReload({ target })` reloads the document of `target`, the global `window` by default. Without either, such as in a server render, opening does nothing, `native.window` is `null` and `reload` settles as `unsupported`.

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
