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
  running: { web: readWebRelease },
  routes: { web },
});

const stop = beacon.start();

await beacon.check({ reason: "startup" });
```

Constructing, reading and subscribing start nothing: `start()` opens the observation session and `dispose()` ends it for good. Every observable has `get()`, `subscribe()` and `getInitial()`, the value before any session, which is what a server renders. `get()` keeps its identity until something meaningful changes.

## Routes

- **`targetRoute`** offers a replacement whatever its order. It is for a deployment, which can roll back to an older build. Its source answers a target decision.
- **`newerRoute`** offers only a release that orders newer under a version strategy from `@priemskiyyy/beacon/versions`: `semver()`, `integer()` or `custom()`. Its source answers a candidate with an order.
- A route a provider owns, such as Expo Updates or Google Play, comes from an adapter package: `routes: { ota: expoUpdates({ updates }) }`.

An application imports all of the above from `@priemskiyyy/beacon`. A source of your own is made with `createReleaseSource({ name, read })`, and a mechanism with `createUpdateMechanism({ name, subject, open, commands })`; those, `createReleaseDriver` and the types an adapter author writes come from `@priemskiyyy/beacon/adapter`. Sources that share one object share one read, so keep one source per authority and `select` a view of it for each route.

## Support

`supportPolicy({ source, evaluate })` is the application's own policy: a view of a source's document and a pure function of it and what is running. `beacon.support` publishes `unknown`, `supported`, `deprecated` or `unsupported` with the reasons and the routes that would satisfy it, and whether each is usable now. A policy that lapses is unknown with its last decision kept, and a failing check never turns `supported` into `unsupported`. A requirement is satisfied only by newly observed running facts or a new accepted policy, never by opening a store or downloading. The forced upgrade is one call, `minimumBuild({ source, remediation })`, which reads the native build of either platform and is unknown, never unsupported, when it cannot.

## Journal

Turn on `journal: { storage }`, with a key-value store such as AsyncStorage or `localStorage` as it is, and Beacon writes an intent before a command that replaces the realm, then reads it back on the next boot: `beacon.transitions` says whether that boot runs the target, runs what ran before, runs something else, or cannot tell. `latest.judgedHere` is true only in the boot that judged the intent, so "Updated." shows once. An intent is not proof a dispatch happened, and nothing here says an installation succeeded or that the boot is healthy: `beacon.reportReady({ checkpoint })` is the application saying its own code reached a point. `best-effort`, the default, goes on and says storage degraded; `required` stops a command whose intent could not be persisted. A storage call that does not answer within `timeouts.journal` (10 seconds by default) counts as failed, so a storage that hangs cannot hang a command. Storage is yours, and no counter is atomic across tabs.

## Scope

A Beacon speaks for one scope: an application in an environment, on a platform, through a distribution. `beacon.replaceScope(next)` puts another in force all at once. Everything the old scope taught is forgotten (the documents, the offers and the references to them, what a provider prepared, the support evaluated from them and the journal's intents), the results of its reads are dropped, and an open session starts again with the next scope. What is running is never rewritten: a new environment label does not change the build in memory.

```ts
const replacement = beacon.replaceScope({ ...scope, environment: "staging" });

if (replacement.status === "blocked") {
  console.info(replacement.route);
}
```

A route whose operation is running or unresolved blocks the replacement, since that work cannot be given to another scope: acknowledge it first. An equal scope is `unchanged`, and nothing is touched.

## Checking when the app returns

Beacon has no timer of its own. To check when the app comes to the foreground, or now and then, call `beacon.check({ reason })` from your own signal: checks join a read already under way, so overlapping signals cost one request, and `reason` shows up in the diagnostics. `checkOn` of `@priemskiyyy/beacon/triggers` makes those calls for you, from startup, a return from the background, a reconnect, an interval or a push; it is a subpath of this package, structural, imports no SDK and subscribes to nothing before you call it ([triggers](../../docs/triggers.md)).

```ts
pulse.on("foreground", async () => {
  await beacon.check({ reason: "foreground" });
});
```

## Commands

Each command declares which reference it needs (`offer`, `prepared`, `optional-offer` or `none`), what it can do to the running application (`impacts`), and how tightly it is bound (`binding`). A route gets one method per command:

```ts
const outcome = await beacon.route("web").reload({ offer: observation.offer });

if (outcome.status === "blocked") {
  console.info(outcome.reasons.map((reason) => reason.code));
}
```

Every expected failure is a status of the outcome, never a rejection: `accepted`, `blocked`, `stale`, `unsupported`, `cancelled`, `failed` or `indeterminate`. `accepted` carries a receipt that names what was accepted. A command that replaces the realm leaves its route unresolved until `route.acknowledge()`.

Register what a disruptive command must not catch with `beacon.disruptions.register(participant)`: a participant reserves synchronously, settles its own work, and is checked again before the provider is asked.

## Subpaths

- `@priemskiyyy/beacon/adapter`: `createReleaseSource`, `createUpdateMechanism`, `createReleaseDriver`, `parseUtcTimestamp`, the identity domain words and the contexts, drafts and results an adapter author writes. An application never needs it.
- `@priemskiyyy/beacon/versions`: `semver`, `integer`, `custom`, and the types of a strategy (`VersionStrategy`, `Comparison`, `SemVer`).
- `@priemskiyyy/beacon/mock`: `createMockSource` and `createTestClock`, for tests.
- `@priemskiyyy/beacon/testing`: `testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism` and `testReleaseDriver`, the conformance suites an adapter runs in its own tests. They need `vitest`.
