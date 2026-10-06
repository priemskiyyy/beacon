---
description: "Four recipes: an update banner that waits for a saved form, a forced upgrade when support ends, checks on foreground and on an interval, and staged messages for each platform."
---

# Recipes

Each recipe is a complete piece of an application. They share two Beacons. The web one is registered for the React hooks, and the native one has an Expo route and a Play route.

```ts
// src/beacon.ts
import { Beacon, createBootId, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseSource,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";

// Your source of the deployment decision; see the HTTP page.
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
    web: () => ({
      identity: {
        status: "known",
        authority: "com.example.notes",
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
      source: manifest.select((document) => document.web),
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

```ts
// src/native.ts
import { Beacon, createBootId } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import * as Updates from "expo-updates";

declare const bridge: PlayBridge;

export const native = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: "google-play",
  },
  running: {
    boot: { id: createBootId() },
    bundle: expoBundle(Updates),
  },
  routes: {
    ota: expoUpdates({ updates: Updates }),
    binary: googlePlay({ bridge }),
  },
});
```

## An update banner that waits for a saved form

The user has a form with unsaved edits, and a new build is on offer. The banner offers the update. If the form blocks it, the banner says why and lets the user try again. A participant in the form does the guarding; see [React](react.md#guarding-unsaved-work).

```tsx
// src/UpdateBanner.tsx
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { useState } from "react";

const messages: Record<string, string> = {
  "unsaved-draft": "Save your draft, then update.",
  "draft-not-saved": "Your draft could not be saved. Try again.",
  "operation-in-progress": "An update is already starting.",
  "operation-indeterminate":
    "An update was requested. Reload the page to finish.",
  "settlement-timeout": "Saving took too long. Try again.",
};

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const observation = useRoute("web", (snapshot) => snapshot.observation);
  const [notice, setNotice] = useState<string | null>(null);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const route = beacon.route("web");
    const outcome = await route.reload({ offer: observation.offer.ref });

    if (outcome.status === "accepted") {
      setNotice("Reloading.");

      return;
    }

    if (outcome.status === "blocked") {
      const [reason] = outcome.reasons;

      setNotice(messages[reason?.code ?? ""] ?? "Not now. Try again.");

      return;
    }

    if (outcome.status === "stale") {
      // The offer was replaced or its evidence lapsed. Ask again and let the banner follow.
      await route.check({ reason: "manual" });
      setNotice("There is a newer version. Check the banner again.");

      return;
    }

    setNotice("The update could not start.");
  };

  return (
    <aside>
      <button onClick={update}>Update</button>
      {notice === null ? null : <p role="status">{notice}</p>}
    </aside>
  );
};
```

Three things make this safe.

- A blocked call is never queued. Nothing happens later by itself, so the button is the retry.
- The offer stays in the state while the user saves. If its evidence lapses meanwhile, the call settles as `stale` with `expired` and the banner checks again.
- After `accepted`, the document may stay alive, and the route stays unresolved. A second click is blocked with `operation-indeterminate`, and the banner says so.

## Forced upgrade when support ends

Support says the running build is `unsupported`. Show a screen that says so, offer the required update when it is usable, and give the user a way out when it is not. Never answer with an endless redirect.

```tsx
// src/SupportGate.tsx
import { useBeacon, useRoute, useSupport } from "@priemskiyyy/beacon-react";
import type { ReactNode } from "react";

export const SupportGate = ({ children }: { children: ReactNode }) => {
  const beacon = useBeacon();
  const support = useSupport();
  const observation = useRoute("web", (snapshot) => snapshot.observation);

  if (support.status !== "unsupported") {
    return <>{children}</>;
  }

  const required = (support.evaluation?.remediation ?? []).filter(
    (entry) => entry.level === "required" && entry.usable,
  );

  if (required.length > 0 && observation.status === "available") {
    const { ref } = observation.offer;

    return (
      <section role="alert">
        <h1>This version is no longer supported</h1>
        <button onClick={() => beacon.route("web").reload({ offer: ref })}>
          Update now
        </button>
      </section>
    );
  }

  return (
    <section role="alert">
      <h1>This version is no longer supported</h1>
      <p>The update is not available yet.</p>
      <button onClick={() => beacon.check({ reason: "manual" })}>
        Try again
      </button>
    </section>
  );
};
```

`unsupported` is a verdict of your policy. `unknown` is not. A policy that lapsed is `unknown` with its last decision kept beside it, and how long you tolerate that is your decision. See [support](support.md#when-support-ends). The remediation here is the route `web`. With several routes, pick the entry by its `route` name.

## Check on foreground and on an interval

Beacon has no timer of its own. You call `check` from the signals your application already has, and checks that overlap join one read, so several signals at once cost one request. The `reason` only labels the diagnostics.

On the web:

```ts
// src/watchForUpdates.ts
import { beacon } from "src/beacon";

export const watchForUpdates = (interval: number) => {
  const stop = beacon.start();

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      beacon.check({ reason: "foreground" });
    }
  };

  const handleOnline = () => {
    beacon.check({ reason: "reconnect" });
  };

  document.addEventListener("visibilitychange", handleVisibility);
  addEventListener("online", handleOnline);

  const timer = setInterval(() => {
    beacon.check({ reason: "interval" });
  }, interval);

  beacon.check({ reason: "startup" });

  return () => {
    clearInterval(timer);
    removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
    stop();
  };
};
```

In React Native, use `AppState`:

```ts
// src/watchNative.ts
import { AppState } from "react-native";

import { native } from "src/native";

export const watchNative = () => {
  const stop = native.start();

  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      native.check({ reason: "foreground" });
    }
  });

  native.check({ reason: "startup" });

  return () => {
    subscription.remove();
    stop();
  };
};
```

Two habits keep this cheap. Pick an interval that matches how fast you deploy, and add jitter so a fleet does not check in step. Do not check faster than your authority's `expiresAt`: a check that returns the same revision is a renewal, and nothing more. A check on a timer is only as good as the runtime that runs it, and a backgrounded app or tab may run none, so keep the foreground check.

## Staged messaging per platform

The same idea, "an update is available", is a different sequence of steps on each platform. Read the route state and say which step the user is at.

### Web

One step: the offer, then a reload. See the banner above.

### Expo Updates

Three steps: an update is on offer, it is downloading, it is ready to restart.

```ts
// src/otaStage.ts
import { native } from "src/native";

export type OtaStage = "nothing" | "available" | "downloading" | "ready";

export const readOtaStage = (): OtaStage => {
  const { observation, prepared, operation } = native.route("ota").state.get();

  if (operation.state === "running" && operation.command === "download") {
    return "downloading";
  }

  if (prepared.status === "ready") {
    return "ready";
  }

  if (observation.status === "available") {
    return "available";
  }

  return "nothing";
};

export const nextOtaStep = async () => {
  const route = native.route("ota");
  const { observation, prepared } = route.state.get();

  if (prepared.status === "ready") {
    return route.reload({ prepared: prepared.value.ref });
  }

  if (observation.status === "available") {
    return route.download({ offer: observation.offer.ref });
  }

  return null;
};
```

`ready` comes from the provider's report, never from the download call having returned. Because an update that was downloaded can be selected at a later start, tell the user before you download.

### Google Play

The flexible flow has three steps, the same as Expo, with progress from Play. A high-priority update can use the immediate flow, which takes over the screen.

```ts
// src/playStage.ts
import { native } from "src/native";

export type PlayStage =
  | { step: "nothing" }
  | { step: "available"; flow: "flexible" | "immediate" }
  | { step: "downloading"; progress: number | null }
  | { step: "ready" };

export const readPlayStage = (): PlayStage => {
  const { observation, prepared, operation } = native
    .route("binary")
    .state.get();

  if (operation.state === "running" && operation.command === "download") {
    return { step: "downloading", progress: operation.progress };
  }

  if (prepared.status === "ready") {
    return { step: "ready" };
  }

  if (observation.status !== "available") {
    return { step: "nothing" };
  }

  const { offer } = observation;

  if (offer.priority >= 4 && offer.flows.includes("immediate")) {
    return { step: "available", flow: "immediate" };
  }

  if (offer.flows.includes("flexible")) {
    return { step: "available", flow: "flexible" };
  }

  return { step: "nothing" };
};
```

`progress` is a fraction between 0 and 1, or `null` when Play gave no total. Never draw a percentage from a `null`.

### App Store and service worker

The App Store has one step, and it leaves the app: say that the user is going to the store, then call `openStore`. Nothing says the user installed anything, and the route settles as soon as the OS accepts the request.

A service worker has two steps. `available` means an update is ready and the release is unknown, so say only that. After `activate`, wait for `prepared` to be `ready`, and then offer the reload.

### Say what you know

| Platform       | Say                                             | Do not say                               |
| -------------- | ----------------------------------------------- | ---------------------------------------- |
| Web            | "A new version is available. Reload to get it." | "Version 2.5 is running"                 |
| Expo           | "An update is ready. Restart to apply it."      | "Updated" after `download`               |
| Google Play    | "An update was downloaded. Restart to finish."  | "Installed" after `restart` is accepted  |
| App Store      | "Open the App Store to update."                 | "Updating" after `openStore` is accepted |
| Service worker | "An update is ready."                           | Which build it is                        |

Only a later boot shows what runs. Say what the receipt says.
