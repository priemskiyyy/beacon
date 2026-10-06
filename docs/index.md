---
description: "Beacon keeps one model of what your app runs, what its release authorities want, and which update actions can be requested, in React and React Native apps: an update banner that never restarts over unsaved input, and a forced upgrade."
---

# Beacon

Release awareness and update coordination for React and React Native apps.

[Get started on the web](getting-started.md) · [Get started in React Native](react-native.md) · [The mental model](mental-model.md) · [View on GitHub](https://github.com/priemskiyyy/beacon)

::: info Verification
Everything is tested in process against fakes. The minimal React app, the release labs and the browser package's storage and build reader also run in Chromium, the minimal Expo app against fake modules, and nothing has run on a device yet. See [verification](verification.md) and [limits](limits.md).
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

## Which packages do I install?

| You build                | Install                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An Expo app              | `@priemskiyyy/beacon`, `@priemskiyyy/beacon-react`, `@priemskiyyy/beacon-expo`, and the SDKs `expo-updates` and `expo-application`                       |
| A React Native app       | `@priemskiyyy/beacon`, `@priemskiyyy/beacon-react`, `@priemskiyyy/beacon-device-info`, and `@priemskiyyy/beacon-code-push` if you use CodePush           |
| A web app in React       | `@priemskiyyy/beacon`, `@priemskiyyy/beacon-react`, `@priemskiyyy/beacon-http`, `@priemskiyyy/beacon-browser`                                            |
| A web app in another one | the same, with `@priemskiyyy/beacon-vue`, `@priemskiyyy/beacon-solid` or `@priemskiyyy/beacon-svelte` in place of the React package                      |
| A forced upgrade         | `@priemskiyyy/beacon-app-store` and `@priemskiyyy/beacon-google-play` for the store page, and `@priemskiyyy/beacon-firebase-remote-config` for a minimum |

[Getting started](getting-started.md) and [React Native](react-native.md) have the exact lines. Every package is ESM only, side-effect free and typed. The core has no dependencies, and no adapter imports a provider SDK: you pass in the one you already use. The README has [a line for each package](https://github.com/priemskiyyy/beacon#packages).

## Where Beacon stops

It is not an installer, a cache, a scheduler or a policy engine. It has no timer and subscribes to nothing until you ask, and [triggers](triggers.md) is the optional subpath of the core that checks on the moments you name. It never claims more than a provider gave, and it never turns a missing fact into an old version. [Limits](limits.md) lists what it does not guarantee.

## Where to go next

- Getting started: [the web](getting-started.md), then [React Native](react-native.md).
- Guides: [recipes](recipes.md), [guarding unsaved input](disruptions.md), [the journal](journal.md), [triggers](triggers.md), [the React hooks](react.md), [testing](testing.md) and [devtools](devtools.md).
- Concepts: [the mental model](mental-model.md), [routes](routes.md), [support](support.md), [scopes](scopes.md) and [sessions](sessions.md).
- Adapters: [HTTP](http.md), [browser](browser.md), [service worker](service-worker.md), [Expo](expo.md), [device info](device-info.md), [CodePush](code-push.md), [App Store](app-store.md), [Google Play](google-play.md), [Firebase Remote Config](firebase-remote-config.md) and [custom adapters](custom-adapters.md).
- Reference: [API](api.md), [commands](commands.md), [troubleshooting](troubleshooting.md), [limits](limits.md), [verification](verification.md) and [decisions](decisions.md).
- Other frameworks: [Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md).
- Internals: [architecture](internals/architecture.md).
