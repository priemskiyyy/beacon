---
description: "Every public export of every Beacon package with one line each: the core and its subpaths, the adapters and the React, Vue, Solid and Svelte bindings and the devtools."
---

# API

Every name a package root exports, with one line each. A package's `index.test.ts` checks that its root exports exactly the runtime names listed here, and `pnpm verify:docs` checks that this page lists every name of every entry point under that entry point's heading. Each type has a JSDoc with an example, so your editor shows more than a line.

## @priemskiyyy/beacon

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
```

### Runtime

| Export                   | Kind     | What it is                                                                                |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `Beacon`                 | class    | one application-owned model of release awareness over named routes; inert until `start()` |
| `BeaconError`            | class    | an error Beacon created, with a `code` to branch on and the original as `cause`           |
| `compareIdentities`      | function | relates two release identities as `same`, `different` or `incomparable`                   |
| `createBootId`           | function | a new boot id: a version 4 UUID that works on every engine, for `running.boot.id`         |
| `createReleaseDriver`    | function | declares a provider-owned route from its driver                                           |
| `createReleaseSource`    | function | makes a release source from a name and a `read`                                           |
| `createUpdateMechanism`  | function | declares a mechanism so its native type and commands are inferred together                |
| `keyValueJournalStorage` | function | the journal's storage over any store with `getItem`, `setItem` and `removeItem`           |
| `newerRoute`             | function | a route that offers a candidate only when it is admitted and orders newer than what runs  |
| `parseUtcTimestamp`      | function | epoch milliseconds of a UTC timestamp such as `2026-09-27T10:00:00Z`, or `undefined`      |
| `supportPolicy`          | function | declares the application's support policy over a view of a source                         |
| `targetRoute`            | function | a route that offers the release an authority names when it is a different, comparable one |

### The Beacon

| Member                 | What it is                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `start()`              | opens the observation session and answers its stop                                           |
| `stop()`               | ends the open session                                                                        |
| `dispose()`            | ends the Beacon for good                                                                     |
| `check(options)`       | asks every route's authority and the support policy; never rejects                           |
| `route(name)`          | the stable handle of one route                                                               |
| `replaceScope(next)`   | puts another scope in force                                                                  |
| `reportReady(options)` | records that the application reached a checkpoint in this boot; throws `DISPOSED` afterwards |
| `clearJournal()`       | removes the journal's record                                                                 |
| `status`               | where the session stands                                                                     |
| `running`              | what is executing, per subject                                                               |
| `support`              | what the support policy says about what runs                                                 |
| `transitions`          | what the journal knows                                                                       |
| `diagnostics`          | a passive snapshot and event stream                                                          |
| `disruptions`          | where participants register                                                                  |
| `clock`                | the `BeaconClock` the Beacon runs on, for what must share its time and timers                |

### Options, scope and running facts

| Type                 | What it is                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `BeaconOptions`      | what one Beacon observes: scope, running readers, routes, policy, timeouts, journal, clock |
| `BeaconClock`        | every time source and timer Beacon uses: `now`, `setTimer`                                 |
| `BeaconStatus`       | `idle`, `running`, `stopped` or `disposed`                                                 |
| `ReleaseScope`       | one application in one environment, on one platform, through one distribution              |
| `ScopeReplacement`   | how `replaceScope` settled: `replaced`, `unchanged` or `blocked`                           |
| `RunningReaders`     | where the running facts come from: the boot id and one reader per subject                  |
| `RunningReader`      | the one local authority for a running fact                                                 |
| `RunningRelease`     | a release that is executing: identity, label and raw platform values                       |
| `RunningApplication` | the composite of what is executing, with a revision                                        |
| `RunningFact`        | what is known of one subject: `unconfigured`, `pending`, `known` or `failed`               |
| `RunningSubject`     | `native`, `bundle`, `web` or `worker`                                                      |

### Releases, decisions and evidence

| Type                   | What it is                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `Release`              | a release an authority names: identity, label, compatibility, metadata               |
| `ReleaseIdentity`      | which release something is: known within an authority and domain, or unknown         |
| `IdentityRelation`     | `same`, `different` or `incomparable`                                                |
| `Compatibility`        | whether a release can run where it would be installed                                |
| `TargetDecision`       | an authority's statement that a scope should run one release                         |
| `CandidateDecision`    | an authority's statement that a release exists, with the order its strategy compares |
| `NoneDecision`         | an authority's explicit statement that it has no release for a scope                 |
| `DecisionRevision`     | how an authority numbers its decisions: opaque or ordered                            |
| `ReleaseSelection`     | what selection decided about one release: offer, none or inconclusive                |
| `ReleaseSource`        | a reader of one release authority, with `read` and `select`                          |
| `ReleaseSourceOptions` | a name and a `read` for `createReleaseSource`                                        |
| `SourceRead`           | what a source answers: a validated document and the evidence to judge it             |
| `SourceReadContext`    | what a read is given: the scope, a signal, the attempt number and the Beacon's clock |
| `Projection`           | one typed view of a source's document, sharing its one read                          |
| `Evidence`             | what backs an observation: source, origin, times, freshness, issuer, revision        |
| `EvidenceOrigin`       | `network`, `provider`, `application` or `persisted`                                  |

### Routes and their state

| Type                 | What it is                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `FeedRoute`          | a route whose offers come from a source and whose commands come from a mechanism          |
| `DriverRoute`        | a route a provider driver owns                                                            |
| `RouteDefinition`    | any route a Beacon accepts, at its widest                                                 |
| `RouteHandle`        | the stable handle of one route: state, native, capabilities, check, acknowledge, commands |
| `RouteSnapshot`      | everything published about a route: check, observation, prepared and operation            |
| `RouteSnapshotOf`    | the snapshot of a route by its name and definition                                        |
| `TargetRouteOptions` | the options of `targetRoute`                                                              |
| `NewerRouteOptions`  | the options of `newerRoute`                                                               |
| `RouteBody`          | what every offer and prepared target carries: the release                                 |
| `RouteCapabilities`  | what each command of a route declares, as constants                                       |
| `CheckOptions`       | how to check: `reason`, `mode` and `signal`                                               |
| `CheckOutcome`       | how one caller's check settled: `succeeded`, `failed`, `cancelled` or `superseded`        |
| `CheckReason`        | why a check was requested, for diagnostics                                                |
| `CheckReport`        | the outcome of every route and of the support policy, apart                               |
| `CheckState`         | the latest check attempt of a route                                                       |
| `Observation`        | what a route has accepted: `unknown`, `none`, `available` or `inconclusive`               |
| `ObservationDraft`   | what a provider driver reports about its route, before evidence is attached               |
| `Offer`              | the current interpretation of what an authority wants, with a reference to act on         |
| `OfferReference`     | a handle on one offer, minted by Beacon                                                   |
| `Prepared`           | something a provider reports as ready for a later step                                    |
| `PreparedDraft`      | what a provider reports as ready: nothing, or a target it confirms                        |
| `PreparedReference`  | a handle on something a provider reports as ready, minted by Beacon                       |
| `PreparedState`      | whether the provider reports something ready                                              |
| `OperationState`     | the command a route is carrying out: `idle`, `running` or `indeterminate`                 |
| `NoOfferReason`      | why a check that succeeded has nothing to offer                                           |
| `InconclusiveReason` | why a check that succeeded cannot say whether a release is on offer                       |
| `UnknownReason`      | why a route has no observation at all                                                     |

### Commands

| Type                | What it is                                                                      |
| ------------------- | ------------------------------------------------------------------------------- |
| `CommandArguments`  | the arguments a route method takes, derived from what its command declares      |
| `CommandDescriptor` | one command a route offers: reference, impacts, binding and `run`               |
| `CommandFacade`     | the methods a route gets from its commands                                      |
| `CommandMap`        | the commands of one mechanism or driver by name                                 |
| `CommandOutcome`    | how a command settled, as one of seven statuses                                 |
| `CommandParameters` | what a command may take besides its references                                  |
| `CommandRunContext` | what every command receives: the native handle, a signal and its parameters     |
| `ProviderResult`    | what a provider command reports, and nothing more than the provider proves      |
| `BlockReason`       | why a disruptive command may not run now: a code and the participant that asked |
| `StaleReason`       | why a command refused a reference                                               |
| `Impact`            | what a command can do to the running application                                |
| `TargetBinding`     | how tightly a command is bound to what the user was shown                       |

### Writing an adapter

| Type               | What it is                                                                     |
| ------------------ | ------------------------------------------------------------------------------ |
| `UpdateMechanism`  | the commands of a route whose offers come from a source                        |
| `MechanismSession` | what a mechanism keeps open while a session runs                               |
| `ReleaseDriver`    | a route whose provider owns both the question and the answer                   |
| `DriverContext`    | what a driver is given when its route opens                                    |
| `DriverEmitter`    | how a driver reports what its provider says between checks                     |
| `DriverSession`    | a driver's open session: the native handle, `check`, `reconcile` and `dispose` |

### Disruptions

| Type                    | What it is                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| `Disruptions`           | where an application registers what a disruptive command must not catch |
| `DisruptionParticipant` | an application resource a disruptive command must not catch             |
| `ReserveContext`        | what a participant is told when a command asks for its reservation      |
| `ReserveResult`         | a participant's answer to a reservation: `blocked` or `reserved`        |
| `Settlement`            | what a participant answers once it has settled: `ready` or `blocked`    |

### Support

| Type                   | What it is                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| `SupportPolicy`        | the application's policy: a view of a source and a pure `evaluate`          |
| `SupportEvaluation`    | one evaluation: verdict, remediation, the running revision and the evidence |
| `SupportReason`        | why a policy reached its verdict: a code and the subject                    |
| `SupportState`         | everything published about support                                          |
| `SupportStatus`        | `unknown`, `supported`, `deprecated` or `unsupported`                       |
| `SupportUnknownReason` | why support is unknown when Beacon reached that itself                      |
| `SupportVerdict`       | what `evaluate` answers: status, reasons and remediation                    |
| `Remediation`          | a route the policy names as a way to satisfy it, and how much it matters    |
| `RemediationState`     | a remediation with whether its route is usable now                          |

### Journal

| Type                     | What it is                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `JournalOptions`         | turns the journal on: mode, storage, budget and retention                                 |
| `JournalStorage`         | the minimal storage a journal needs: `read`, `write` and `remove`                         |
| `KeyValueStoreLike`      | the three calls of a key-value store: `getItem`, `setItem` and `removeItem`               |
| `KeyValueJournalOptions` | whether a write is read back, and how a journal key maps to the store's own               |
| `TransitionIntent`       | what Beacon recorded before it asked a provider to replace the realm                      |
| `TransitionState`        | what the journal knows: its status, latest intent, dropped count and checkpoints          |
| `Reconciliation`         | an intent, what the running facts say about it, and the attempts                          |
| `ReconciliationOutcome`  | `same-boot`, `target-running`, `target-not-running`, `different-target` or `inconclusive` |
| `ReadyReport`            | what `reportReady` answers: `recorded` or `already-recorded`                              |

### Errors, diagnostics and observables

| Type                        | What it is                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| `BeaconErrorCode`           | the closed set of codes of an error Beacon created                    |
| `BeaconErrorInfo`           | what published state keeps of a failure: its code and message         |
| `BeaconDiagnostics`         | a passive view for logs and devtools: a snapshot and an event stream  |
| `BeaconDiagnosticCounters`  | running counts of what Beacon dropped or contained                    |
| `BeaconDiagnosticEvent`     | one frozen record of something Beacon did                             |
| `BeaconDiagnosticEventType` | what a diagnostic event records                                       |
| `BeaconDiagnosticSnapshot`  | what Beacon holds right now: the status, the session and the counters |
| `ObservableValue`           | a readable snapshot with `get`, `getInitial` and `subscribe`          |
| `SelectorOptions`           | `{ isEqual }`, how a binding decides that a selection is the same     |

### Version types

| Type                   | What it is                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `VersionStrategy`      | how one domain of versions is parsed, ordered and admitted |
| `Comparison`           | `older`, `equal`, `newer` or `incomparable`                |
| `SemVer`               | a strictly parsed Semantic Versioning 2.0.0 string         |
| `SemVerIdentifier`     | one dot-separated prerelease identifier                    |
| `SemVerOptions`        | whether `semver()` admits prereleases                      |
| `CustomVersionOptions` | a version domain of your own                               |

## @priemskiyyy/beacon/versions

| Export    | Kind     | What it is                                                                            |
| --------- | -------- | ------------------------------------------------------------------------------------- |
| `semver`  | function | strict Semantic Versioning 2.0.0, with prereleases excluded unless you include them   |
| `integer` | function | non-negative integers as safe integers or canonical decimal strings, compared exactly |
| `custom`  | function | a version domain of your own                                                          |

## @priemskiyyy/beacon/mock

| Export                     | Kind     | What it is                                                                   |
| -------------------------- | -------- | ---------------------------------------------------------------------------- |
| `createMockSource`         | function | a scriptable release source whose reads are held until the test settles them |
| `createTestClock`          | function | a manual `BeaconClock` that runs its timers only when a test advances it     |
| `createGate`               | function | a gate a fake provider waits at, held and released by the test               |
| `createMockJournalStorage` | function | an in-memory journal storage that a test can hold, refuse and look into      |
| `settle`                   | function | lets every queued promise continuation run before the test goes on           |
| `Gate`                     | type     | the gate: `hold`, `release` and `wait`                                       |
| `MockJournalStorage`       | type     | a journal storage with `records`, call counts and hold and fail knobs        |
| `MockSource`               | type     | the mock source and how to answer, hold, resolve and reject its reads        |
| `MockSourceStats`          | type     | reads started, reads held and reads aborted                                  |
| `TestClock`                | type     | a `BeaconClock` with `advance`, `suspend`, `setNow` and `pendingTimers`      |

## @priemskiyyy/beacon/testing

These need `vitest`.

| Export                              | Kind     | What it is                                                       |
| ----------------------------------- | -------- | ---------------------------------------------------------------- |
| `testJournalStorage`                | function | the contract every journal storage keeps                         |
| `testRunningReader`                 | function | the contract every running reader keeps                          |
| `testReleaseSource`                 | function | the contract every release source keeps                          |
| `testVersionStrategy`               | function | the contract every version strategy keeps                        |
| `testUpdateMechanism`               | function | the contract every update mechanism keeps                        |
| `testReleaseDriver`                 | function | the contract every provider driver keeps                         |
| `JournalStorageFixture`             | type     | a journal storage under test, and how to open it again           |
| `RunningReaderFixture`              | type     | a running reader under test, and how often it asked its host     |
| `RunningReaderSituation`            | type     | a state of the fake host, and what the reader must answer in it  |
| `RunningReaderConformanceOptions`   | type     | what a running reader's suite is run over                        |
| `JournalStorageConformanceOptions`  | type     | what a journal storage's suite is run over                       |
| `ReleaseSourceFixture`              | type     | a source under test and how many requests it made of its backend |
| `ReleaseSourceConformanceOptions`   | type     | what a source's suite is run over                                |
| `VersionStrategyConformanceOptions` | type     | what a strategy's suite is run over                              |
| `UpdateMechanismFixture`            | type     | a mechanism under test, and what it holds on its platform        |
| `UpdateMechanismConformanceOptions` | type     | what a mechanism's suite is run over                             |
| `ReleaseDriverFixture`              | type     | a driver route under test and the provider's change events       |
| `ReleaseDriverConformanceOptions`   | type     | what a driver's suite is run over                                |

## @priemskiyyy/beacon-http

See [HTTP](http.md).

| Export                          | Kind     | What it is                                                                          |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `http`                          | function | your manifest endpoint as a release source, through your client                     |
| `readStandardManifest`          | function | a standard manifest response as an answer of `http`                                 |
| `standardManifestSource`        | function | a standard manifest at a URL as a release source, over the global `fetch` or yours  |
| `parseStandardManifest`         | function | the text of a standard manifest as a valid read, or an error naming the rule broken |
| `HttpOptions`                   | type     | the name and the `fetch` of `http()`                                                |
| `ManifestFetch`                 | type     | the request `standardManifestSource` makes: a URL and the options of one request    |
| `StandardManifestSourceOptions` | type     | the URL, routes, client, headers, name and limits of `standardManifestSource`       |
| `HttpFetchContext`              | type     | what one read hands your client: scope, signal, attempt, clock and validator        |
| `HttpAnswer`                    | type     | what your client resolves: a document, or `not-modified`                            |
| `ManifestLimits`                | type     | the tunable limits of a manifest: bytes, lifetime and skew                          |
| `ManifestMetadata`              | type     | the short strings a manifest may attach to a release                                |
| `ManifestResponse`              | type     | the part of a `Response` that reading a manifest needs                              |
| `OrderKind`                     | type     | how a candidate's order is written: `text` or `integer`                             |
| `ParseStandardManifestOptions`  | type     | the text, scope, routes, time and limits of a parse                                 |
| `ReadStandardManifestOptions`   | type     | the response, scope, routes, time and limits of a read                              |
| `RouteDeclaration`              | type     | what the application expects of one route: `target` or `candidate`                  |
| `RouteDeclarations`             | type     | the routes the application reads from a manifest, by name                           |
| `StandardDecision`              | type     | the decision a declared route holds once the manifest is read                       |
| `StandardManifest`              | type     | the document of a valid manifest: one decision for each route, and the support      |
| `StandardRead`                  | type     | a valid manifest with its evidence                                                  |
| `StandardSupport`               | type     | the support facts of a manifest: a denylist for your policy                         |

## @priemskiyyy/beacon-browser

See [browser](browser.md).

| Export                     | Kind     | What it is                                                                                        |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `browserReload`            | function | a mechanism with one command, `reload`, bound to nothing                                          |
| `browserStorage`           | function | the journal's storage in the tab's `sessionStorage`, or `localStorage` with `area: "local"`       |
| `webBuild`                 | function | the reader of the running web build, from the id the bundler injects; an id nobody set is unknown |
| `webRelease`               | function | the release a source names for a web build, which `webBuild` reads back when it runs              |
| `BrowserReloadOptions`     | type     | the window whose document is reloaded                                                             |
| `BrowserNative`            | type     | what `route.native` exposes: the window, or `null`                                                |
| `BrowserWindowLike`        | type     | the part of a window the mechanism uses: `location.reload()`                                      |
| `BrowserReloadReceipt`     | type     | `reload-requested`                                                                                |
| `BrowserStorageArea`       | type     | `session` or `local`                                                                              |
| `BrowserStorageOptions`    | type     | the area, the window and whether a write is read back                                             |
| `BrowserStorageWindowLike` | type     | the part of a window the storage uses: its two areas of web storage                               |
| `WebReleaseOptions`        | type     | the authority, id and label of `webRelease`                                                       |
| `WebBuildOptions`          | type     | the authority, the injected id, an optional label and the domain                                  |

## @priemskiyyy/beacon-service-worker

See [service worker](service-worker.md).

| Export                    | Kind     | What it is                                                                    |
| ------------------------- | -------- | ----------------------------------------------------------------------------- |
| `serviceWorker`           | function | a service worker registration as a route, with `activate` and `reload`        |
| `ServiceWorkerOptions`    | type     | the container, registration, window and message                               |
| `ServiceWorkerNative`     | type     | what `route.native` exposes: the container and a way to find the registration |
| `ServiceWorkerWindow`     | type     | the part of a window a reload uses                                            |
| `ContainerLike`           | type     | the part of `navigator.serviceWorker` the adapter uses                        |
| `RegistrationLike`        | type     | the part of a `ServiceWorkerRegistration` the adapter uses                    |
| `WorkerLike`              | type     | the part of a `ServiceWorker` the adapter uses                                |
| `WorkerMessage`           | type     | the message a page posts to a worker                                          |
| `WorkerBody`              | type     | what an offer and a prepared target carry: the worker's id                    |
| `WorkerActivationReceipt` | type     | `activation-requested`, with the worker's id                                  |
| `WorkerReloadReceipt`     | type     | `reload-requested`                                                            |

## @priemskiyyy/beacon-expo

See [Expo](expo.md).

| Export                | Kind     | What it is                                                          |
| --------------------- | -------- | ------------------------------------------------------------------- |
| `expoUpdates`         | function | Expo Updates as a route, with `download` and `reload`               |
| `expoBundle`          | function | the reader of the running bundle, from the `expo-updates` constants |
| `ExpoOptions`         | type     | the `expo-updates` module to pass in                                |
| `ExpoNative`          | type     | what `route.native` exposes: the module                             |
| `ExpoBody`            | type     | what an offer carries: an `update` or a `rollback-to-embedded`      |
| `ExpoDownloadReceipt` | type     | `update-prepared`, `rollback-prepared` or `no-new-preparation`      |
| `ExpoReloadReceipt`   | type     | `reload-requested`                                                  |
| `UpdatesLike`         | type     | the part of the `expo-updates` module the adapter uses              |
| `CheckResultLike`     | type     | the part of `UpdateCheckResult` the adapter reads                   |
| `FetchResultLike`     | type     | the part of `UpdateFetchResult` the adapter reads                   |

## @priemskiyyy/beacon-google-play

See [Google Play](google-play.md).

| Export              | Kind     | What it is                                                                       |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `googlePlay`        | function | Play's in-app updates as a route, with `download`, `update` and `restart`        |
| `PlayOptions`       | type     | the bridge to pass in                                                            |
| `PlayBridge`        | type     | the contract a native module keeps for the adapter                               |
| `PlayNative`        | type     | what `route.native` exposes: the bridge                                          |
| `PlayOffer`         | type     | what an offer carries: flows, priority, staleness and whether one is in progress |
| `PlayPrepared`      | type     | a flexible update Play reports as downloaded                                     |
| `PlayReceipt`       | type     | `update-downloaded`, `immediate-flow-started` or `completion-requested`          |
| `PlayUpdateInfo`    | type     | what a fresh query of Play says, in its four categories                          |
| `PlayFlowResult`    | type     | how a native consent flow ended: `started`, `cancelled` or `failed`              |
| `PlayInstallEvent`  | type     | one report of Play's install state, with byte counts or `null`                   |
| `PlayInstallStatus` | type     | where Play's install of an update stands                                         |

## @priemskiyyy/beacon-app-store

See [App Store](app-store.md).

| Export                   | Kind     | What it is                                                             |
| ------------------------ | -------- | ---------------------------------------------------------------------- |
| `appStoreLookup`         | function | App Store metadata as an advisory release source                       |
| `appStoreHandoff`        | function | a mechanism that opens the store page, with `openStore`                |
| `appleVersion`           | function | the version strategy of Apple marketing versions                       |
| `appleMarketingVersion`  | function | reads the marketing version of what runs, for `newerRoute`'s `current` |
| `AppStoreLookupOptions`  | type     | the app id, storefront, bundle id, name and `fetch`                    |
| `AppStoreFetchContext`   | type     | what one lookup hands your client: the URL and a signal                |
| `AppStoreLookupResponse` | type     | what your client resolves: the lookup's entries                        |
| `AppStoreLookupEntry`    | type     | one result of Apple's lookup, with the fields the adapter reads        |
| `AppStoreDocument`       | type     | the document the lookup source answers: one decision                   |
| `AppStoreMetadata`       | type     | the release date, in epoch milliseconds                                |
| `AppStoreHandoffOptions` | type     | the app id and the link opener                                         |
| `LinkingLike`            | type     | the part of React Native's `Linking` the handoff uses                  |
| `AppStoreHandoffReceipt` | type     | `store-handoff-requested`                                              |
| `AppleVersion`           | type     | a marketing version as three numbers                                   |

## @priemskiyyy/beacon-firebase-remote-config

See [Firebase Remote Config](firebase-remote-config.md).

| Export                        | Kind     | What it is                                                                                        |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `firebaseRemoteConfig`        | function | Firebase Remote Config as a release source, such as a minimum build, built from the server's text |
| `FirebaseRemoteConfigOptions` | type     | the instance, the SDK module, the document builder, `name`, `maxAge` and `onFetchFailure`         |
| `RemoteConfigLike`            | type     | the part of a Remote Config instance the source reads                                             |
| `RemoteConfigModuleLike`      | type     | the three functions of the SDK module the source calls                                            |
| `RemoteValueLike`             | type     | one parameter: its text and where it came from                                                    |
| `RemoteParameters`            | type     | what the document builder reads: `remote(key)` and `source(key)`                                  |

## @priemskiyyy/beacon-code-push

See [CodePush](code-push.md).

| Export                    | Kind     | What it is                                                                               |
| ------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `codePushUpdates`         | function | the React Native CodePush family as a route, with `download` and `reload`                |
| `codePushBundle`          | function | the reader of the running bundle, from the package CodePush says runs                    |
| `CodePushOptions`         | type     | the CodePush module to pass in                                                           |
| `CodePushNative`          | type     | what `route.native` exposes: the module                                                  |
| `CodePushOffer`           | type     | what an offer carries: the label, whether it is mandatory and whether it was rolled back |
| `CodePushPrepared`        | type     | a package CodePush lists as pending: the label and whether it is mandatory               |
| `CodePushDownloadReceipt` | type     | `update-staged`, with the hash and the label                                             |
| `CodePushReloadReceipt`   | type     | `reload-requested`                                                                       |
| `CodePushLike`            | type     | the part of a CodePush module the adapter uses                                           |
| `RemotePackageLike`       | type     | the part of a `RemotePackage` the adapter uses                                           |
| `LocalPackageLike`        | type     | the part of a `LocalPackage` the adapter uses                                            |
| `DownloadProgressLike`    | type     | the bytes received and the bytes expected of a download                                  |

## @priemskiyyy/beacon-native

See [Native build](native.md).

| Export                   | Kind     | What it is                                                                              |
| ------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `expoApplication`        | function | the reader of the installed binary, from the constants of `expo-application`            |
| `deviceInfo`             | function | the reader of the installed binary, from `react-native-device-info`                     |
| `ExpoApplicationOptions` | type     | the `expo-application` module and the options every native reader takes                 |
| `DeviceInfoOptions`      | type     | the `react-native-device-info` default export and the options every native reader takes |
| `NativeReaderOptions`    | type     | the platform, the authority and the domain                                              |
| `NativePlatform`         | type     | `android` or `ios`                                                                      |
| `ApplicationLike`        | type     | the part of the `expo-application` module the reader uses                               |
| `DeviceInfoLike`         | type     | the part of `react-native-device-info` the reader uses                                  |

## @priemskiyyy/beacon-triggers

See [Triggers](triggers.md).

| Export                 | Kind     | What it is                                                                                         |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `checkOn`              | function | checks the Beacon on the moments its triggers name, and answers its stop                           |
| `startup`              | function | a trigger that checks once each time a session opens                                               |
| `foreground`           | function | a trigger that checks when React Native's `AppState` comes back from the background                |
| `pulseForeground`      | function | a trigger that checks when a Pulse says the app returned                                           |
| `reconnect`            | function | a trigger that checks when NetInfo goes from not connected to connected                            |
| `reachReconnect`       | function | a trigger that checks when a Reach condition goes from unmet to met                                |
| `interval`             | function | a trigger that checks every delay after the last check that settled, paused in the background      |
| `invalidation`         | function | a trigger that checks when a source says "look again", and never reads what it sends               |
| `CheckOnOptions`       | type     | the triggers, the minimum interval, the backoff, the freshness rule, the expiry and the random     |
| `BeaconTrigger`        | type     | a moment to check on: installed with a target when a session opens, it answers how to take it back |
| `TriggerTarget`        | type     | what a trigger is given: `signal`, the clock, the random source, and where the app is              |
| `AppStateLike`         | type     | the part of React Native's `AppState` the `foreground` trigger uses                                |
| `NetInfoLike`          | type     | the part of `@react-native-community/netinfo` the `reconnect` trigger uses                         |
| `ForegroundSourceLike` | type     | what `pulseForeground` listens to: a Pulse satisfies it                                            |
| `ConditionLike`        | type     | what `reachReconnect` listens to: a Reach condition satisfies it                                   |
| `Subscribable`         | type     | anything that only says "look again", for `invalidation`                                           |

## @priemskiyyy/beacon-react

See [React](react.md).

| Export                 | Kind      | What it is                                                          |
| ---------------------- | --------- | ------------------------------------------------------------------- |
| `BeaconProvider`       | component | publishes a Beacon; with `start` it holds the session while mounted |
| `useRoute`             | hook      | a route's state by its name, optionally selected                    |
| `useRunning`           | hook      | what is running per subject                                         |
| `useSupport`           | hook      | what the support policy says about what runs                        |
| `useTransitions`       | hook      | what the journal knows                                              |
| `useStatus`            | hook      | where the session stands                                            |
| `useObservable`        | hook      | any other observable of Beacon                                      |
| `useDisruption`        | hook      | registers a participant while mounted                               |
| `useBeacon`            | hook      | the provider's Beacon                                               |
| `Register`             | interface | merge `beacon` into it so the hooks know your routes                |
| `RegisteredBeacon`     | type      | the Beacon you registered                                           |
| `RegisteredRoutes`     | type      | the routes of the registered Beacon                                 |
| `RegisteredRouteName`  | type      | the name of a route of the registered Beacon                        |
| `RegisteredRoute`      | type      | the handle of a route of the registered Beacon                      |
| `RegisteredRouteState` | type      | the state of a route of the registered Beacon                       |
| `BeaconProviderProps`  | type      | the Beacon to publish, and whether to start                         |
| `SelectorOptions`      | type      | the core's `{ isEqual }`, re-exported for the hooks                 |

## @priemskiyyy/beacon-vue

See [Vue](vue.md).

| Export                 | Kind       | What it is                                                                    |
| ---------------------- | ---------- | ----------------------------------------------------------------------------- |
| `BeaconProvider`       | component  | publishes a Beacon; with `start` it holds the session while mounted           |
| `useRoute`             | composable | a route's state by its name, optionally selected, as a read-only computed ref |
| `useRunning`           | composable | what is running per subject                                                   |
| `useSupport`           | composable | what the support policy says about what runs                                  |
| `useTransitions`       | composable | what the journal knows                                                        |
| `useStatus`            | composable | where the session stands                                                      |
| `useObservable`        | composable | any other observable of Beacon                                                |
| `useDisruption`        | composable | registers a participant while mounted                                         |
| `useBeacon`            | composable | the provider's Beacon, as a computed ref                                      |
| `Register`             | interface  | merge `beacon` into it so the composables know your routes                    |
| `RegisteredBeacon`     | type       | the Beacon you registered                                                     |
| `RegisteredRoutes`     | type       | the routes of the registered Beacon                                           |
| `RegisteredRouteName`  | type       | the name of a route of the registered Beacon                                  |
| `RegisteredRoute`      | type       | the handle of a route of the registered Beacon                                |
| `RegisteredRouteState` | type       | the state of a route of the registered Beacon                                 |
| `BeaconProviderProps`  | type       | the Beacon to publish, and whether to start                                   |
| `SelectorOptions`      | type       | the core's `{ isEqual }`, re-exported for the composables                     |

## @priemskiyyy/beacon-solid

See [Solid](solid.md).

| Export                 | Kind      | What it is                                                          |
| ---------------------- | --------- | ------------------------------------------------------------------- |
| `BeaconProvider`       | component | publishes a Beacon; with `start` it holds the session while mounted |
| `useRoute`             | primitive | a route's state by its name, optionally selected, as an accessor    |
| `useRunning`           | primitive | what is running per subject                                         |
| `useSupport`           | primitive | what the support policy says about what runs                        |
| `useTransitions`       | primitive | what the journal knows                                              |
| `useStatus`            | primitive | where the session stands                                            |
| `useObservable`        | primitive | any other observable of Beacon                                      |
| `useDisruption`        | primitive | registers a participant while mounted                               |
| `useBeacon`            | primitive | the provider's Beacon, as an accessor                               |
| `Register`             | interface | merge `beacon` into it so the primitives know your routes           |
| `RegisteredBeacon`     | type      | the Beacon you registered                                           |
| `RegisteredRoutes`     | type      | the routes of the registered Beacon                                 |
| `RegisteredRouteName`  | type      | the name of a route of the registered Beacon                        |
| `RegisteredRoute`      | type      | the handle of a route of the registered Beacon                      |
| `RegisteredRouteState` | type      | the state of a route of the registered Beacon                       |
| `BeaconProviderProps`  | type      | the Beacon to publish, and whether to start                         |
| `SelectorOptions`      | type      | the core's `{ isEqual }`, re-exported for the primitives            |

## @priemskiyyy/beacon-svelte

See [Svelte](svelte.md).

| Export                 | Kind      | What it is                                                          |
| ---------------------- | --------- | ------------------------------------------------------------------- |
| `BeaconProvider`       | component | publishes a Beacon; with `start` it holds the session while mounted |
| `useRoute`             | utility   | a route's state by its name, optionally selected, through `current` |
| `useRunning`           | utility   | what is running per subject                                         |
| `useSupport`           | utility   | what the support policy says about what runs                        |
| `useTransitions`       | utility   | what the journal knows                                              |
| `useStatus`            | utility   | where the session stands                                            |
| `useObservable`        | utility   | any other observable of Beacon                                      |
| `useDisruption`        | utility   | registers a participant while mounted                               |
| `useBeacon`            | utility   | the provider's Beacon through `current`                             |
| `Register`             | interface | merge `beacon` into it so the utilities know your routes            |
| `RegisteredBeacon`     | type      | the Beacon you registered                                           |
| `RegisteredRoutes`     | type      | the routes of the registered Beacon                                 |
| `RegisteredRouteName`  | type      | the name of a route of the registered Beacon                        |
| `RegisteredRoute`      | type      | the handle of a route of the registered Beacon                      |
| `RegisteredRouteState` | type      | the state of a route of the registered Beacon                       |
| `BeaconProviderProps`  | type      | the Beacon to publish, and whether to start                         |
| `ReadableValue`        | type      | what a utility returns: an object with a read-only `current`        |
| `SelectorOptions`      | type      | the core's `{ isEqual }`, re-exported for the utilities             |

## @priemskiyyy/beacon-devtools

See [Devtools](devtools.md). The root exports the inspector for any framework.

| Export                  | Kind  | What it is                                             |
| ----------------------- | ----- | ------------------------------------------------------ |
| `BeaconDevtools`        | class | mounts the inspector into an element                   |
| `BeaconDevtoolsOptions` | type  | the Beacon to inspect, `initialIsOpen` and `maxEvents` |
| `BeaconDevtoolsProps`   | type  | the options without the Beacon, for a wrapper          |

## @priemskiyyy/beacon-devtools/react

The wrapper for React, which reads the Beacon from the nearest `BeaconProvider`.

| Export                | Kind      | What it is                                     |
| --------------------- | --------- | ---------------------------------------------- |
| `BeaconDevtools`      | component | mounts the inspector for the provider's Beacon |
| `BeaconDevtoolsProps` | type      | `initialIsOpen` and `maxEvents`                |
