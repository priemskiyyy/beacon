# Beacon

**Release awareness and update coordination for TypeScript applications, on the web and in React Native.**

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
  const outcome = await beacon.route("web").requestReload({
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

Every package is ESM only, side-effect free and typed. The core has no dependencies, and no adapter imports a provider SDK: you pass in the one you already use.

## Status

Everything is tested in process against fakes, and the Expo and React Native adapters are typechecked against their real SDK types. Nothing has run on a device or in a real browser yet. [The decision record](docs/decisions.md) lists where the implementation departs from its specification and what is not built yet, and [the verification table](docs/verification.md) shows which of the specification's 202 scenarios have a test.

## Documentation

- The README of each package above.
- [Decisions](docs/decisions.md), the [runtime architecture](docs/internals/architecture.md) and the [verification table](docs/verification.md).
- [Contributing](CONTRIBUTING.md), [support](SUPPORT.md) and [security](SECURITY.md).

## License

MIT
