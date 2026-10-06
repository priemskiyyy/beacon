---
description: "Set up Beacon for a web application with an HTTP manifest, the browser reload and a framework binding, then for React Native with Expo Updates, one step at a time."
---

# Getting started

Two setups follow. [The browser](#the-browser) reads a release manifest and reloads the document. [React Native](#react-native-and-expo) asks Expo Updates and restarts the runtime. Both end with a check and a command the user asks for. The browser setup uses React, and the Vue, Solid and Svelte bindings work the same way.

## The browser

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http @priemskiyyy/beacon-browser @priemskiyyy/beacon-react
```

::: tip Not using React?
Install `@priemskiyyy/beacon-vue`, `@priemskiyyy/beacon-solid` or `@priemskiyyy/beacon-svelte` in place of the React package. Steps 1 and 2 are the same, except that `Register` is merged into the module of the binding you chose. Steps 3 to 5 have a version for each framework on its own page: [Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md).
:::

### 1. Publish a manifest

Your deployment writes `/releases.json`. It states what one application, environment, platform and distribution should run.

```json
{
  "schemaVersion": 1,
  "application": "com.example.notes",
  "environment": "production",
  "platform": "web",
  "distribution": "public-web",
  "decisionRevision": {
    "kind": "ordered",
    "domain": "notes-web-deployments",
    "epoch": "production-v1",
    "value": "208"
  },
  "issuedAt": "2026-09-27T10:00:00Z",
  "expiresAt": "2026-09-27T10:10:00Z",
  "routes": {
    "web": {
      "kind": "target",
      "release": {
        "identity": {
          "status": "known",
          "authority": "com.example.notes",
          "domain": "web-artifact",
          "value": "web-build-b"
        },
        "label": "September release"
      }
    }
  }
}
```

Three rules matter here. The `identity` must use the same `authority` and `domain` as what the page reports it is running, or the two cannot be compared. The `decisionRevision` grows with every deployment decision, so an older copy served late is rejected. The manifest expires within 24 hours of `issuedAt`, and past `expiresAt` it is no longer evidence. [The HTTP page](http.md) has the whole schema.

### 2. Create the Beacon

One Beacon serves the whole application, so create it in a module of its own.

```ts
// src/beacon.ts
import { Beacon, createBootId, targetRoute } from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

// Your bundler replaces this with the id of the build, such as the commit.
declare const __BUILD_ID__: string;

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

const routes = { web: { kind: "target" } } satisfies RouteDeclarations;

const manifest = http({
  fetch: async ({ scope, signal, validator }) =>
    readStandardManifest({
      response: await fetch("/releases.json", {
        signal,
        headers: validator === null ? {} : { "if-none-match": validator },
      }),
      scope,
      routes,
      now: Date.now(),
    }),
});

export const beacon = new Beacon({
  scope,
  running: {
    boot: { id: createBootId() },
    web: webBuild({ authority: scope.application, id: __BUILD_ID__ }),
  },
  routes: {
    web: targetRoute({
      subject: "web",
      source: manifest.select((document) => document.routes.web),
      mechanism: browserReload(),
    }),
  },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

Read it from the top.

- **`scope`** says who the manifest must speak for. A manifest for another environment is refused whole.
- **`request`** is your client call. It fetches, sends the validator back as `If-None-Match`, and lets `readStandardManifest` turn the response into a validated document. Beacon makes no request of its own.
- **`boot.id`** names this document. It is minted once per page load, never per build, so the journal can tell one boot from the next. `createBootId()` makes one on every engine, Hermes included, which has no `crypto.randomUUID` without a polyfill.
- **`running.web`** reads what executes now, from the build and never from the manifest. `webBuild` names the build under your application as authority and the domain `web-artifact`, which is what the manifest's release says, and a build id the bundler never injected is unknown and never a build named `undefined`.
- **`targetRoute`** offers the release the manifest names when it is a different, comparable release from the one running.
- **`Register`** tells the React hooks which Beacon you have, so `useRoute("web")` is checked and typed.

Constructing a Beacon starts nothing.

### 3. Publish it and start the session

```tsx
// src/main.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { createRoot } from "react-dom/client";

import { App } from "src/App";
import { beacon } from "src/beacon";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element.");
}

createRoot(container).render(
  <BeaconProvider beacon={beacon} start>
    <App />
  </BeaconProvider>,
);
```

With `start`, the provider opens the observation session while it is mounted. That reads the running facts and opens the browser mechanism. It checks nothing and fetches nothing.

### 4. Check

A check asks each route's authority. Beacon has no timer of its own, so you decide when. Check when the app starts, then again when the page returns to the foreground.

```tsx
// src/App.tsx
import { useBeacon } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";

import { UpdateBanner } from "src/UpdateBanner";

export const App = () => {
  const beacon = useBeacon();

  useEffect(() => {
    beacon.check({ reason: "startup" });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        beacon.check({ reason: "foreground" });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [beacon]);

  return (
    <main>
      <UpdateBanner />
    </main>
  );
};
```

The provider starts the session in a layout effect, before the `useEffect` of any child, so the first check finds it running. `check` never rejects. Overlapping checks join one read, so two signals at once cost one request. [Triggers](triggers.md) is the package that makes these moments, with a reconnect and an interval besides, for the web as well as React Native.

### 5. Show the update

```tsx
// src/UpdateBanner.tsx
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const observation = useRoute("web", (snapshot) => snapshot.observation);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const outcome = await beacon
      .route("web")
      .reload({ offer: observation.offer.ref });

    if (outcome.status !== "accepted") {
      console.warn("The update did not start:", outcome.status);
    }
  };

  return (
    <button onClick={update}>
      Update to {observation.offer.release.label ?? "the new version"}
    </button>
  );
};
```

The route `observation` has four states: `unknown`, `none`, `available` and `inconclusive`. Only `available` carries an offer. The `offer.ref` is a reference Beacon minted, and `reload` takes it back. `reload` needs an offer because the browser reload is declared with `reference: "offer"`.

### What happens on the click

1. Beacon checks that the offer is still the route's current one and that its evidence still holds.
2. Every participant registered with `beacon.disruptions` is asked to reserve, then to settle. A participant that guards unsaved work can block the reload here. See [disruptions](disruptions.md).
3. The browser adapter calls `location.reload()` and the outcome is `accepted` with the receipt `reload-requested`.

Nothing here says which build the next document runs. The reload binds to no build: the next navigation receives whatever is deployed. After an accepted reload, the old document may stay alive, so the route stays unresolved and refuses another command until you call `beacon.route("web").acknowledge()`. In practice the page is gone by then.

## React Native and Expo

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-expo @priemskiyyy/beacon-native @priemskiyyy/beacon-triggers expo-updates expo-application
```

Expo Updates decides eligibility, fetches assets and picks what starts next. The adapter maps what it says. The module goes in as an argument, so the adapter imports no SDK.

```ts
// src/beacon.native.ts
import { Beacon, createBootId } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import { expoApplication } from "@priemskiyyy/beacon-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    // Yours to say. The App Store route answers only for "app-store".
    distribution: "app-store",
  },
  running: {
    boot: { id: createBootId() },
    bundle: expoBundle(Updates),
    native: expoApplication({
      application: Application,
      platform: Platform.OS === "ios" ? "ios" : "android",
      authority: "com.example.notes",
    }),
  },
  routes: { ota: expoUpdates({ updates: Updates }) },
});
```

`expoBundle` reads the update that launched. Where updates are disabled, such as in development or Expo Go, its identity is unknown and the route says `unknown` with the reason `unsupported-environment`, never `none`. `expoApplication` reads the installed binary, its version code on Android or its build number on iOS, in the words the store adapters and the journal compare in, and a binary of another application, such as Expo Go, is unknown and never your build.

Start the session at bootstrap, check when the app starts and when it returns from the background, and apply an update in two commands: `download` prepares it and `reload` restarts the runtime with it.

```ts
// src/updates.ts
import { checkOn, foreground, startup } from "@priemskiyyy/beacon-triggers";
import { AppState } from "react-native";

import { beacon } from "src/beacon.native";

export const startUpdates = () => {
  const stop = beacon.start();

  // Only a trip through the background is a return: on iOS a system dialog is inactive and back to active, and `foreground` knows it.
  const stopChecking = checkOn(beacon, {
    triggers: [startup(), foreground({ appState: AppState })],
  });

  return () => {
    stopChecking();
    stop();
  };
};

export const applyUpdate = async () => {
  const route = beacon.route("ota");
  const { observation } = route.state.get();

  if (observation.status !== "available") {
    return "nothing-on-offer";
  }

  const download = await route.download({ offer: observation.offer.ref });

  if (download.status !== "accepted") {
    return download.status;
  }

  const { prepared } = route.state.get();

  if (prepared.status !== "ready") {
    return "nothing-prepared";
  }

  const restart = await route.reload({ prepared: prepared.value.ref });

  return restart.status;
};
```

`download` fetches the provider's current selection, which can differ from the update you were shown. Its receipt says `same`, `different` or `unknown`, and a different update gets a prepared reference of its own. `reload` takes that prepared reference and restarts the JavaScript runtime. No code after it is guaranteed to run, and the route stays unresolved until `route.acknowledge()`.

The React hooks work the same way as above. Register the Beacon in the same fashion, and read the route by its name with `useRoute("ota")`. [React Native](react-native.md) is the whole path for a device: the provider, Fast Refresh, what a reload keeps, guarding unsaved input and what no device has run.

## Next

- [The mental model](mental-model.md) explains the vocabulary used above.
- Your framework: [React](react.md), [Vue](vue.md), [Solid](solid.md) or [Svelte](svelte.md), with every hook, composable, primitive or utility.
- [Recipes](recipes.md) has a banner that waits for a saved form, and a forced upgrade.
- [Testing](testing.md) runs all of this without a browser or a device.
