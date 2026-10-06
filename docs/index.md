---
description: "Beacon keeps one model of what your application runs, what its release authorities want, and which update actions can be requested, on the web and in React Native."
---

# Beacon

Release awareness and update coordination for TypeScript applications, on the web and in React Native.

[Get started](getting-started.md) · [The mental model](mental-model.md) · [View on GitHub](https://github.com/priemskiyyy/beacon)

::: info Verification
Everything is tested in process against fakes. Nothing has run in a real browser or on a device yet. See [verification](verification.md) and [limits](limits.md).
:::

## The problem

Comparing a build id with a manifest field looks like an update check. It hides the questions that decide whether the check is right. Is the answer stale? What if the running build is unknown? Did the reload happen? Will the user lose a form they have not saved?

Beacon owns those questions. Transport, storage, policy and presentation stay with you.

## The model

- **Routes.** One `Beacon` holds named routes. A route is one thing that can be updated: the web document, a JavaScript bundle, the native binary, a service worker.
- **Running facts.** You pass readers that say what executes now. A subject that is not read yet is pending, never an old version.
- **Evidence.** What an authority wants is kept with its source, its receipt time and its expiry. A failed check never erases it, and it goes stale by time alone.
- **References.** An offer is a reference that Beacon minted. A command takes one, and a copy, a forgery or a reference of another route is refused.
- **Commands.** A route gets one typed method per command. Each settles as a status and never rejects. An accepted command is a request, not an installation.
- **Disruption.** Participants that guard unsaved work reserve, settle and are checked again before a provider is asked.

Beacon does not download bundles, install binaries, cache assets or decide policy on its own.

## Install

| Package                              | Use it for                                                  |
| ------------------------------------ | ----------------------------------------------------------- |
| `@priemskiyyy/beacon`                | The runtime, `./versions`, `./mock` and `./testing`         |
| `@priemskiyyy/beacon-http`           | Your own release manifest endpoint, through your own client |
| `@priemskiyyy/beacon-browser`        | Reloading the browser document                              |
| `@priemskiyyy/beacon-service-worker` | A waiting service worker as an update that is ready         |
| `@priemskiyyy/beacon-expo`           | Expo Updates                                                |
| `@priemskiyyy/beacon-google-play`    | Google Play in-app updates, over a native bridge you inject |
| `@priemskiyyy/beacon-app-store`      | App Store metadata and store handoff                        |
| `@priemskiyyy/beacon-react`          | A provider and hooks, typed by the Beacon you register      |
| `@priemskiyyy/beacon-vue`            | A provider and composables for Vue, typed the same way      |
| `@priemskiyyy/beacon-solid`          | A provider and primitives for Solid, typed the same way     |
| `@priemskiyyy/beacon-svelte`         | A provider and utilities for Svelte 5, typed the same way   |

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-http @priemskiyyy/beacon-browser
```

Every package is ESM only, side-effect free and typed. The core has no dependencies, and no adapter imports a provider SDK: you pass in the one you already use.

## An example

A web application, a manifest at `/releases.json`, and a reload the user asks for.

```ts
import { Beacon, createBootId, targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

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
    web: () => ({
      identity: {
        status: "known",
        authority: scope.application,
        domain: "web-artifact",
        value: __BUILD_ID__,
      },
      label: null,
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

beacon.start();

await beacon.check({ reason: "startup" });

const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });

  console.info(outcome.status);
}
```

`outcome.status` is `accepted` when the reload was requested. It says nothing about which build the next document runs. Only the next boot shows that.

## Where Beacon stops

It is not an installer, a cache, a scheduler or a policy engine. It never claims more than a provider gave, and it never turns a missing fact into an old version. [Limits](limits.md) lists what it does not guarantee.

## Where to go next

- [Getting started](getting-started.md): the browser with HTTP and a framework binding, then React Native with Expo.
- [The mental model](mental-model.md): subjects, routes, decisions, evidence, references and outcomes.
- Guides: [routes](routes.md), [commands](commands.md), [support](support.md), [disruptions](disruptions.md), [journal](journal.md), [scopes](scopes.md) and [sessions](sessions.md).
- Adapters: [HTTP](http.md), [browser](browser.md), [service worker](service-worker.md), [Expo](expo.md), [Google Play](google-play.md), [App Store](app-store.md) and [custom adapters](custom-adapters.md).
- Bindings: [React](react.md), [Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md).
- [Recipes](recipes.md), [testing](testing.md) and [troubleshooting](troubleshooting.md).
- [API](api.md), [verification](verification.md), [limits](limits.md), [decisions](decisions.md) and [architecture](internals/architecture.md).
