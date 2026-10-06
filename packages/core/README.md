# @priemskiyyy/beacon

Typed, reactive release awareness and update coordination. Beacon keeps one model of what your application is running, what its release authorities want, and which provider actions can be requested, without claiming an installation nobody observed.

```sh
pnpm add @priemskiyyy/beacon
```

## The model

One `Beacon` holds named routes. A route has a state in four dimensions that never rewrite each other: the latest **check**, the accepted **observation**, what the provider has **prepared**, and the running **operation**. `beacon.running` holds what is executing per subject (`native`, `bundle`, `web`, `worker`), read from readers you pass; a subject that is not read yet is pending, never an old version.

```ts
const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { boot: { id: BOOT_ID }, web: readWebRelease },
  routes: { web },
});

const stop = beacon.start();

await beacon.check({ reason: "startup" });
```

Constructing, reading and subscribing start nothing: `start()` opens the observation session and `dispose()` ends it for good. Every observable has `get()` and `subscribe()`, and `get()` keeps its identity until something meaningful changes.

## Routes

- **`targetRoute`** offers a replacement whatever its order. It is for a deployment, which can roll back to an older build. Its source answers a target decision.
- **`newerRoute`** offers only a release that orders newer under a version strategy from `@priemskiyyy/beacon/versions`: `semver()`, `integer()` or `custom()`. Its source answers a candidate with an order.
- **`createReleaseDriver`** declares a route a provider owns, such as Expo Updates or Google Play. Adapter packages return one.

A route's source is made with `createReleaseSource({ name, read })`, and its commands come from `createUpdateMechanism({ name, open, commands })`. Sources that share one object share one read, so keep one source per authority and `select` a view of it for each route.

## Support

`supportPolicy({ source, evaluate })` is the application's own policy: a view of a source's document and a pure function of it and what is running. `beacon.support` publishes `unknown`, `supported`, `deprecated` or `unsupported` with the reasons and the routes that would satisfy it, and whether each is usable now. A policy that lapses is unknown with its last decision kept, and a failing check never turns `supported` into `unsupported`. A requirement is satisfied only by newly observed running facts or a new accepted policy, never by opening a store or downloading.

## Commands

Each command declares which reference it needs (`offer`, `prepared`, `optional-offer` or `none`), what it can do to the running application (`impacts`), and how tightly it is bound (`binding`). A route gets one method per command:

```ts
const outcome = await beacon
  .route("web")
  .requestReload({ offer: observation.offer.ref });

if (outcome.status === "blocked") {
  console.info(outcome.reasons.map((reason) => reason.code));
}
```

Every expected failure is a status of the outcome, never a rejection: `accepted`, `blocked`, `stale`, `unsupported`, `cancelled`, `failed` or `indeterminate`. `accepted` carries a receipt that names what was accepted. A command that replaces the realm leaves its route unresolved until `route.acknowledge()`.

Register what a disruptive command must not catch with `beacon.disruptions.register(participant)`: a participant reserves synchronously, settles its own work, and is checked again before the provider is asked.

## Subpaths

- `@priemskiyyy/beacon/versions`: `semver`, `integer`, `custom`.
- `@priemskiyyy/beacon/mock`: `createMockSource` and `createTestClock`, for tests.
- `@priemskiyyy/beacon/testing`: `testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism` and `testReleaseDriver`, the conformance suites an adapter runs in its own tests. They need `vitest`.
