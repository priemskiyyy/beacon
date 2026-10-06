# Beacon

**Release awareness and update coordination for TypeScript applications, on the web and in React Native.**

[Documentation](https://priemskiyyy.github.io/beacon/) · [Changelog](CHANGELOG.md)

Beacon keeps one model of what your application is running, what its release authorities want, and which provider actions can be requested, without claiming an installation nobody observed. A reload, a store handoff and a downloaded update are each a request or a preparation, and only the next boot shows what runs.

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { http } from "@priemskiyyy/beacon-http";

const manifest = http({
  request: async ({ signal, validator }) =>
    parseManifestResponse(await fetchManifest({ signal, validator })),
});

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: {
    boot: { id: BOOT_ID },
    web: () => ({ identity: BUILD_IDENTITY, label: BUILD_LABEL, raw: {} }),
  },
  routes: {
    web: targetRoute({
      subject: "web",
      source: manifest.select((document) => document.web),
      mechanism: browserReload(),
    }),
  },
});

beacon.start();

await beacon.check({ reason: "startup" });

const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  const outcome = await beacon.route("web").reload({
    offer: observation.offer.ref,
  });
}
```

## Why not just compare two version strings

A comparison of a build id with a manifest field hides the questions that matter, and each has a wrong default. Beacon owns what surrounds the comparison:

- **Unknown is an answer.** An identity that cannot be compared is inconclusive, never an upgrade. An unknown identity equals nothing, not even another unknown one.
- **Evidence has a source and a lifetime.** A failed check never erases what was accepted, and an offer goes stale by time alone.
- **Accepted is not installed.** Every command settles as a status, and its receipt names what was accepted: a reload request, a store handoff, a started flow. Nothing changes what is running except a later boot.
- **Commands are typed by what they declare.** A route gets one method per command, with the reference, parameters and receipt that command declares. A reference of another route or another kind does not compile.
- **Disruption is coordinated.** Participants that guard unsaved work reserve, settle and are checked again before a provider is asked. A conflicting command is blocked, never queued, and a command that may have taken effect is never retried blindly.
- **Providers stay in charge.** Expo, Play and the App Store decide eligibility and installs; Beacon maps what they say in full and changes none of their configuration.

Beacon does not download bundles, install binaries, cache assets or decide policy on its own.

## Packages

| Package                                                                  | What it is                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [`@priemskiyyy/beacon`](packages/core)                                   | The runtime, the version strategies, the mocks and the conformance suites |
| [`@priemskiyyy/beacon-http`](packages/adapters/http)                     | Your release manifest endpoint, through your own client                   |
| [`@priemskiyyy/beacon-browser`](packages/adapters/browser)               | Reloading the browser document                                            |
| [`@priemskiyyy/beacon-service-worker`](packages/adapters/service-worker) | A waiting service worker as an update that is ready                       |
| [`@priemskiyyy/beacon-expo`](packages/adapters/expo)                     | Expo Updates                                                              |
| [`@priemskiyyy/beacon-google-play`](packages/adapters/google-play)       | Google Play in-app updates, over a native bridge                          |
| [`@priemskiyyy/beacon-app-store`](packages/adapters/app-store)           | App Store metadata and store handoff                                      |
| [`@priemskiyyy/beacon-react`](packages/react)                            | A provider and hooks                                                      |
| [`@priemskiyyy/beacon-vue`](packages/vue)                                | A provider and composables                                                |
| [`@priemskiyyy/beacon-solid`](packages/solid)                            | A provider and primitives                                                 |
| [`@priemskiyyy/beacon-svelte`](packages/svelte)                          | A provider and utilities, on Svelte 5 runes                               |
| [`@priemskiyyy/beacon-devtools`](packages/devtools)                      | An inspector for the session, the routes and the diagnostic events        |

Every package is ESM only, side-effect free and typed. The core has no dependencies, and no adapter imports a provider SDK: you pass in the one you already use.

## Status

Everything is tested in process against fakes, and the Expo and React Native adapters are typechecked against their real SDK types. The example apps run in Chromium under Playwright against a scripted release lab, in React, Vue, Solid, Svelte and Expo's web build, but nothing has run on a device or against a real provider yet. [The decision record](docs/decisions.md) lists where the implementation departs from its specification and what is not built yet, and [the verification table](docs/verification.md) shows which of the specification's 202 scenarios have a test.

## Documentation

The site is at [priemskiyyy.github.io/beacon](https://priemskiyyy.github.io/beacon/), and `pnpm dev:docs` serves it locally. Its source is in [docs](docs).

| Section                | Pages                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start here             | [Getting started][docs-getting-started] · [The mental model][docs-mental-model]                                                                                                                                   |
| Guides                 | [Routes][docs-routes] · [Commands][docs-commands] · [Support][docs-support] · [Disruptions][docs-disruptions] · [Journal][docs-journal] · [Scopes][docs-scopes] · [Sessions][docs-sessions]                       |
| Adapters               | [HTTP][docs-http] · [Browser][docs-browser] · [Service worker][docs-service-worker] · [Expo][docs-expo] · [Google Play][docs-google-play] · [App Store][docs-app-store] · [Custom adapters][docs-custom-adapters] |
| Build your application | [React][docs-react] · [Vue][docs-vue] · [Solid][docs-solid] · [Svelte][docs-svelte] · [Devtools][docs-devtools] · [Recipes][docs-recipes] · [Testing][docs-testing] · [Troubleshooting][docs-troubleshooting]     |
| Reference              | [API][docs-api] · [Verification][docs-verification] · [Limits][docs-limits] · [Decisions][docs-decisions] · [Architecture][docs-architecture]                                                                     |

Also the README of each package above, and [Contributing](CONTRIBUTING.md), [support](SUPPORT.md) and [security](SECURITY.md).

[docs-getting-started]: https://priemskiyyy.github.io/beacon/getting-started
[docs-mental-model]: https://priemskiyyy.github.io/beacon/mental-model
[docs-routes]: https://priemskiyyy.github.io/beacon/routes
[docs-commands]: https://priemskiyyy.github.io/beacon/commands
[docs-support]: https://priemskiyyy.github.io/beacon/support
[docs-disruptions]: https://priemskiyyy.github.io/beacon/disruptions
[docs-journal]: https://priemskiyyy.github.io/beacon/journal
[docs-scopes]: https://priemskiyyy.github.io/beacon/scopes
[docs-sessions]: https://priemskiyyy.github.io/beacon/sessions
[docs-http]: https://priemskiyyy.github.io/beacon/http
[docs-browser]: https://priemskiyyy.github.io/beacon/browser
[docs-service-worker]: https://priemskiyyy.github.io/beacon/service-worker
[docs-expo]: https://priemskiyyy.github.io/beacon/expo
[docs-google-play]: https://priemskiyyy.github.io/beacon/google-play
[docs-app-store]: https://priemskiyyy.github.io/beacon/app-store
[docs-custom-adapters]: https://priemskiyyy.github.io/beacon/custom-adapters
[docs-react]: https://priemskiyyy.github.io/beacon/react
[docs-vue]: https://priemskiyyy.github.io/beacon/vue
[docs-solid]: https://priemskiyyy.github.io/beacon/solid
[docs-svelte]: https://priemskiyyy.github.io/beacon/svelte
[docs-devtools]: https://priemskiyyy.github.io/beacon/devtools
[docs-recipes]: https://priemskiyyy.github.io/beacon/recipes
[docs-testing]: https://priemskiyyy.github.io/beacon/testing
[docs-troubleshooting]: https://priemskiyyy.github.io/beacon/troubleshooting
[docs-api]: https://priemskiyyy.github.io/beacon/api
[docs-verification]: https://priemskiyyy.github.io/beacon/verification
[docs-limits]: https://priemskiyyy.github.io/beacon/limits
[docs-decisions]: https://priemskiyyy.github.io/beacon/decisions
[docs-architecture]: https://priemskiyyy.github.io/beacon/internals/architecture

## License

MIT
