---
description: "Set up Beacon for a web application with an HTTP manifest, the browser reload and React, then for React Native with Expo Updates, one step at a time."
---

# Getting started

Two setups follow. [The browser](#the-browser) reads a release manifest and reloads the document. [React Native](#react-native-and-expo) asks Expo Updates and restarts the runtime. Both end with a check and a command the user asks for.

## The browser

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http @priemskiyyy/beacon-browser @priemskiyyy/beacon-react
```

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
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
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
  request: async ({ scope, signal, validator }) =>
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
    boot: { id: crypto.randomUUID() },
    web: () => ({
      identity: {
        status: "known",
        authority: scope.application,
        domain: "web-artifact",
        value: __BUILD_ID__,
      },
      label: __BUILD_ID__,
      raw: {},
    }),
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
- **`boot.id`** names this document. It is minted once per page load, never per build, so the journal can tell one boot from the next.
- **`running.web`** reads what executes now, from the build and never from the manifest.
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

A check asks each route's authority. Beacon has no timer of its own, so you decide when. Check once the session runs, then again when the page returns to the foreground.

```tsx
// src/App.tsx
import { useBeacon, useStatus } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";

import { UpdateBanner } from "src/UpdateBanner";

export const App = () => {
  const beacon = useBeacon();
  const running = useStatus(({ state }) => state === "running");

  useEffect(() => {
    if (!running) {
      return;
    }

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
  }, [beacon, running]);

  return (
    <main>
      <UpdateBanner />
    </main>
  );
};
```

The check waits for the session because an effect of a child runs before the effect of its provider: a check in the first effect pass would find no session. `check` never rejects. Overlapping checks join one read, so two signals at once cost one request.

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
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-expo expo-updates
```

Expo Updates decides eligibility, fetches assets and picks what starts next. The adapter maps what it says. The module goes in as an argument, so the adapter imports no SDK.

```ts
// src/beacon.native.ts
import { Beacon } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: "store",
  },
  running: {
    // React Native has no crypto.randomUUID everywhere, and any unique text works.
    boot: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    bundle: expoBundle(Updates),
  },
  routes: { ota: expoUpdates({ updates: Updates }) },
});
```

`expoBundle` reads the update that launched. Where updates are disabled, such as in development or Expo Go, its identity is unknown and the route says `unknown` with the reason `unsupported-environment`, never `none`.

Start the session at bootstrap, check when the app becomes active, and apply an update in two commands: `download` prepares it and `reload` restarts the runtime with it.

```ts
// src/updates.ts
import { AppState } from "react-native";

import { beacon } from "src/beacon.native";

export const startUpdates = () => {
  const stop = beacon.start();

  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      beacon.check({ reason: "foreground" });
    }
  });

  beacon.check({ reason: "startup" });

  return () => {
    subscription.remove();
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

The React hooks work the same way as above. Register the Beacon in the same fashion, and read the route by its name with `useRoute("ota")`.

## Next

- [The mental model](mental-model.md) explains the vocabulary used above.
- [Recipes](recipes.md) has a banner that waits for a saved form, and a forced upgrade.
- [Testing](testing.md) runs all of this without a browser or a device.
