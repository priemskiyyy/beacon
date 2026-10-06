---
description: "Ship a safe update banner on the web: a static manifest, one Beacon with the browser reload and journal, a provider, the banner, a guard for unsaved input, checks on return and reconnect, the cancelled reload and a service worker."
---

# Getting started

This page takes a React app on Vite and a static host to an update banner that never reloads over unsaved input. The Vue, Solid and Svelte bindings work the same way (install `@priemskiyyy/beacon-vue`, `-solid` or `-svelte` in place of the React package), and [React Native](react-native.md) is the same path for an app on a device. Everything after [Next](#next) is optional.

::: tip Which packages do I install?
A web app takes four of ours.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-http @priemskiyyy/beacon-browser
```

:::

## Publish a manifest

Your build writes this file next to the app, with the id of the build it just shipped.

```json
{
  "schemaVersion": 1,
  "routes": {
    "web": {
      "kind": "target",
      "release": { "identity": "a91b44e" }
    }
  }
}
```

The same id goes into the bundle, where the page reads what runs. With Vite that is a variable the build sets once:

```sh
VITE_BUILD_ID=$(git rev-parse --short HEAD) vite build
printf '{"schemaVersion":1,"routes":{"web":{"kind":"target","release":{"identity":"%s"}}}}' "$(git rev-parse --short HEAD)" > dist/releases.json
```

Serve `releases.json` as `application/json`, which a static host does for a `.json` file, with `Cache-Control: no-cache`, so a cache asks the server before it answers and a deploy is seen at once. Nothing else is required of a static host: [the HTTP page](http.md#when-your-release-service-can-write-more) has the optional times, revision and scope.

## Create the Beacon

```ts
// src/beacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import {
  browserReload,
  browserStorage,
  webBuild,
} from "@priemskiyyy/beacon-browser";
import { standardManifestSource } from "@priemskiyyy/beacon-http";

const releases = standardManifestSource({
  url: "/releases.json",
  routes: { web: { kind: "target" } },
});

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { web: webBuild({ id: import.meta.env.VITE_BUILD_ID }) },
  routes: {
    web: targetRoute({
      source: releases.select((manifest) => manifest.routes.web),
      mechanism: browserReload(),
    }),
  },
  journal: { storage: browserStorage() },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

`scope` says which app this is, and a manifest that states another scope is refused whole. `standardManifestSource` fetches the file and judges it. `webBuild` reads which build runs, from the id the bundler wrote into the code and never from the manifest, and a build id nobody injected is unknown, never a build named `undefined`. `browserReload` is the command that replaces the document. `journal` keeps a record in the tab, so the next page load can tell whether the reload reached the new build. `Register` tells the hooks which Beacon you have. Constructing a Beacon starts nothing.

## Start it and check

```tsx
// src/App.tsx
import { checkOn } from "@priemskiyyy/beacon/triggers";
import { foreground, reconnect } from "@priemskiyyy/beacon/triggers/browser";
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";

import { beacon } from "./beacon";
import { DraftForm } from "./DraftForm";
import { UpdateBanner } from "./UpdateBanner";

export const App = () => {
  // Checks when the page loads, when its tab is shown again and when the network comes back.
  useEffect(
    () => checkOn(beacon, { triggers: [foreground(), reconnect()] }),
    [],
  );

  return (
    <BeaconProvider beacon={beacon}>
      <h1>Notes</h1>
      <p>Build {import.meta.env.VITE_BUILD_ID}</p>
      <UpdateBanner />
      <DraftForm />
    </BeaconProvider>
  );
};
```

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.getElementById("root");

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
```

The provider starts the session while it is mounted and ends it when it unmounts, and nothing is fetched before that. `checkOn` installs its triggers only while a session is open, so it checks once when the provider has started one, and the order of the provider and the effect does not matter. It answers its stop, which is what the effect returns. `foreground` also covers a page the browser restores from its back-forward cache, and `main.tsx` only mounts the app.

## Show the update

```tsx
// src/UpdateBanner.tsx
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { useState } from "react";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const { observation } = useRoute("web");
  const [notice, setNotice] = useState<string | null>(null);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const outcome = await beacon
      .route("web")
      .reload({ offer: observation.offer });

    if (outcome.status !== "blocked") {
      return;
    }

    setNotice("Save your note, then update.");
  };

  return (
    <div role="status">
      <p>A new version is ready.</p>
      {notice !== null && <p>{notice}</p>}
      <button onClick={update}>Update</button>
    </div>
  );
};
```

The observation is `available` when the manifest names a build other than the one that runs, and `none` when it names the same one. `reload` takes the offer you were shown. An accepted reload is a request: the page is replaced, and only the next boot shows which build runs.

## Guard unsaved input

```tsx
// src/DraftForm.tsx
import { useDisruption } from "@priemskiyyy/beacon-react";
import { useState } from "react";

export const DraftForm = () => {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");

  useDisruption({
    name: "note",
    reserve: () => {
      if (text !== saved) {
        return { status: "blocked", code: "unsaved-note" };
      }

      return { status: "reserved" };
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(text);
      }}
    >
      <textarea
        aria-label="Note"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit">Save</button>
    </form>
  );
};
```

Beacon asks a participant before a command that would lose what the page holds, and one that names no `impacts` is asked before every such command, the document replacement of this reload included. A blocked reload changes nothing and is safe to try again. The guard answers a question and does not stop typing, so an edit can begin right after it said yes: [disruptions](disruptions.md) has the guard that reserves.

::: details Nothing happens?

1. The session is open? `useBeaconStatus()` says `running`. The provider starts it unless you gave it `start={false}`.
2. A check ran and succeeded? `useRoute("web", (route) => route.check)` is `succeeded`, or `failed` with an `error` that has a code and a message.
3. What does the observation say? `none` with `same-identity` means the manifest names the build that runs, which is the right answer when nothing is deployed. `inconclusive` has a `detail`: `build-id-not-injected` means `VITE_BUILD_ID` was not set where the build ran.
4. Why did a read fail? `beacon.diagnostics.events.subscribe((event) => console.warn(event.type, event.reason, event.cause))` shows what was thrown.
5. The inspector, in development: [Devtools](devtools.md) shows all of it, on the web only.

[Troubleshooting](troubleshooting.md) has each code and reason.
:::

::: warning Do you ship a service worker?
A worker that precaches the app shell (Workbox, `vite-plugin-pwa` by default) answers the reload from its cache: the page comes back as the old build, the banner returns, and the journal says `target-not-running`. Update through [the service worker route](service-worker.md) instead, and keep `releases.json` out of the precache.
:::

## Next

- [Browser](browser.md) has the reload, the running build and the journal's storage, and [HTTP](http.md) the manifest, with a client of your own.
- [Triggers](triggers.md) adds an interval and a backoff to the checks.
- [The journal](journal.md) says "Updated." once the new build runs, and [routes](routes.md) a source of your own.
- Your framework: [React](react.md), [Vue](vue.md), [Solid](solid.md) or [Svelte](svelte.md), with every hook, composable, primitive or utility.
- [The mental model](mental-model.md), [recipes](recipes.md), [testing](testing.md) and [troubleshooting](troubleshooting.md).

### If your page asks before it leaves

A page with a `beforeunload` prompt can be cancelled by the user after `reload` answered `accepted`, and nothing tells the page's Beacon. The route then waits, and the guard stays closed. Release it from a timer, which runs once the prompt is answered, in a file that `main.tsx` imports once:

```ts
// src/leaveGuard.ts
import { beacon } from "./beacon";

// Registered after your own beforeunload guard, so that it sees whether the guard asked for a prompt.
addEventListener("beforeunload", (event) => {
  if (!event.defaultPrevented && event.returnValue === "") {
    return;
  }

  setTimeout(() => beacon.route("web").acknowledge(), 0);
});
```

[Browser](browser.md#a-reload-the-page-cancels) says what it costs and what a real Chromium prompt showed.
