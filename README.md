# Beacon

**Release awareness and update coordination for React and React Native apps.**

[Documentation](https://priemskiyyy.github.io/beacon/) · [Changelog](CHANGELOG.md)

Beacon keeps one model of what your app is running, what its release authorities want and which update actions can be requested, and it never claims an installation nobody observed. A banner that offers an update and never restarts over unsaved input, and a screen that stops a build that is too old, are a few small files. A reload, a store handoff and a downloaded update are each a request or a preparation: only the next boot shows what runs.

## React Native

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-expo
npx expo install expo-updates expo-application
```

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: Platform.OS === "ios" ? "app-store" : "google-play",
  },
  routes: { ota: expoUpdates({ updates: Updates }) },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

```tsx
import { applyUpdate } from "@priemskiyyy/beacon-expo";
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { Button } from "react-native";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const { observation } = useRoute("ota");

  if (observation.status !== "available") {
    return null;
  }

  return (
    <Button title="Update" onPress={() => applyUpdate(beacon.route("ota"))} />
  );
};
```

Put the banner under `<BeaconProvider beacon={beacon}>` and check on return with `checkOn(beacon, { triggers: [foreground({ appState: AppState })] })`. [The React Native guide](docs/react-native.md) adds the guard for unsaved input, a forced-upgrade screen, Expo Go and Jest. Without Expo, [CodePush](docs/code-push.md) and [device info](docs/device-info.md) take the place of `beacon-expo`.

## Web

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-http @priemskiyyy/beacon-browser
```

```ts
// src/beacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";
import { standardManifestSource } from "@priemskiyyy/beacon-http";

const manifest = standardManifestSource({
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
      source: manifest.select((release) => release.routes.web),
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

```tsx
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const { observation } = useRoute("web");

  if (observation.status !== "available") {
    return null;
  }

  return (
    <button
      onClick={() => beacon.route("web").reload({ offer: observation.offer })}
    >
      Update
    </button>
  );
};
```

The manifest is a nine-line file your build writes next to the app, with the id of the build it shipped. [The getting started guide](docs/getting-started.md) shows it and adds the provider, the checks, the guard, the journal and the manifest on a static host. Vue, Solid and Svelte have their own bindings.

## Why not just compare two version strings

A comparison of a build id with a manifest field hides the questions that matter, and each has a wrong default. Beacon owns what surrounds the comparison:

- **Unknown is an answer.** An identity that cannot be compared is inconclusive, never an upgrade.
- **Evidence has a source and a lifetime.** A failed check never erases what was accepted, and an offer goes stale by time alone.
- **Accepted is not installed.** Every command settles as a status, and its receipt names what was accepted: a reload request, a store handoff, a started flow.
- **Commands are typed by what they declare.** A reference of another route or another kind does not compile.
- **Disruption is coordinated.** Participants that guard unsaved work are asked before a provider is, and a conflicting command is blocked, never queued.
- **Providers stay in charge.** Expo, CodePush, Play and the App Store decide eligibility and installs; Beacon maps what they say and changes none of their configuration.

Beacon does not download bundles, install binaries, cache assets or decide policy on its own.

## Packages

Every package is ESM only, side-effect free and typed. The core has no dependencies, and no adapter imports a provider SDK: you pass in the one you already use.

| Package                                                                                  | What it is                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`@priemskiyyy/beacon`](packages/core)                                                   | The runtime, with `./triggers` for checks on a return, a reconnect or a timer, and the version strategies |
| [`@priemskiyyy/beacon-react`](packages/react)                                            | A provider and hooks, for React and React Native                                                          |
| [`@priemskiyyy/beacon-expo`](packages/adapters/expo)                                     | Expo Updates as a route, `applyUpdate`, and the installed build from `expo-application`                   |
| [`@priemskiyyy/beacon-device-info`](packages/adapters/device-info)                       | The installed native build, from `react-native-device-info`                                               |
| [`@priemskiyyy/beacon-code-push`](packages/adapters/code-push)                           | The React Native CodePush family, over the fork you use                                                   |
| [`@priemskiyyy/beacon-app-store`](packages/adapters/app-store)                           | The App Store page of your app as a route, for a forced upgrade                                           |
| [`@priemskiyyy/beacon-google-play`](packages/adapters/google-play)                       | The Play Store page as a route, and Play in-app updates over a bridge you write                           |
| [`@priemskiyyy/beacon-firebase-remote-config`](packages/adapters/firebase-remote-config) | Firebase Remote Config as a source, such as a minimum build                                               |
| [`@priemskiyyy/beacon-http`](packages/adapters/http)                                     | A release manifest at a URL, or your own client, as a source                                              |
| [`@priemskiyyy/beacon-browser`](packages/adapters/browser)                               | Reloading the browser document, the running web build and the journal in web storage                      |
| [`@priemskiyyy/beacon-service-worker`](packages/adapters/service-worker)                 | A waiting service worker as an update that is ready                                                       |
| [`@priemskiyyy/beacon-devtools`](packages/devtools)                                      | A web inspector for the session, the routes and the diagnostic events                                     |

### Other frameworks

| Package                                         | What it is                                                  |
| ----------------------------------------------- | ----------------------------------------------------------- |
| [`@priemskiyyy/beacon-vue`](packages/vue)       | A provider and composables for Vue, typed the same way      |
| [`@priemskiyyy/beacon-solid`](packages/solid)   | A provider and primitives for Solid, typed the same way     |
| [`@priemskiyyy/beacon-svelte`](packages/svelte) | A provider and utilities for Svelte 5 runes, typed the same |

## Requirements

TypeScript 5.4 or later when `skipLibCheck` is off, since the declarations of the framework bindings use `NoInfer`; the Expo and Vite templates leave `skipLibCheck` on. React 18.3 or 19. A server render under React 18 logs its development warning about `useLayoutEffect`, because the provider starts its session in one; React 19 does not.

## Status

Everything is tested in process against fakes, and the Expo, CodePush, Firebase Remote Config and device info packages and the triggers of the core are typechecked against the real types of the SDKs they take. The minimal React app runs in Chromium under Playwright against a real build and a served manifest, the release labs run there over a scripted release lab, and the minimal Expo app is rendered against fake modules and bundled by Metro, but nothing has run on a device or against a real provider yet. [The decision record](docs/decisions.md) lists where the implementation departs from its specification and what is not built yet, and [the verification table](docs/verification.md) shows which of the specification's 202 scenarios have a test.

## Documentation

The site is at [priemskiyyy.github.io/beacon](https://priemskiyyy.github.io/beacon/), and `pnpm dev:docs` serves it locally. Its source is in [docs](docs). The two guides are backed by minimal apps whose files they show as they are, [`examples/expo`](examples/expo) and [`examples/react-minimal`](examples/react-minimal), and the release labs the tests run are in [examples](examples).

| Section          | Pages                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting started  | [Web](docs/getting-started.md) · [React Native](docs/react-native.md)                                                                                                                                                                                                                                                                                                  |
| Guides           | [Recipes](docs/recipes.md) · [Guarding unsaved input](docs/disruptions.md) · [The journal](docs/journal.md) · [Triggers](docs/triggers.md) · [The React hooks](docs/react.md) · [Testing](docs/testing.md) · [Devtools](docs/devtools.md)                                                                                                                              |
| Concepts         | [The mental model](docs/mental-model.md) · [Routes](docs/routes.md) · [Support](docs/support.md) · [Scopes](docs/scopes.md) · [Sessions](docs/sessions.md)                                                                                                                                                                                                             |
| Adapters         | [HTTP](docs/http.md) · [Browser](docs/browser.md) · [Service worker](docs/service-worker.md) · [Expo](docs/expo.md) · [Device info](docs/device-info.md) · [CodePush](docs/code-push.md) · [App Store](docs/app-store.md) · [Google Play](docs/google-play.md) · [Firebase Remote Config](docs/firebase-remote-config.md) · [Custom adapters](docs/custom-adapters.md) |
| Reference        | [API](docs/api.md) · [Commands](docs/commands.md) · [Troubleshooting](docs/troubleshooting.md) · [Limits](docs/limits.md) · [Verification](docs/verification.md) · [Decisions](docs/decisions.md)                                                                                                                                                                      |
| Other frameworks | [Vue](docs/vue.md) · [Solid](docs/solid.md) · [Svelte](docs/svelte.md)                                                                                                                                                                                                                                                                                                 |
| Internals        | [Architecture](docs/internals/architecture.md)                                                                                                                                                                                                                                                                                                                         |

Also the README of each package above, and [Contributing](CONTRIBUTING.md), [support](SUPPORT.md) and [security](SECURITY.md).

## License

MIT
