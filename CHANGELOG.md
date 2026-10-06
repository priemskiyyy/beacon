# Changelog

## @priemskiyyy/beacon 0.1.0 - Unreleased

- First release. `Beacon` keeps one model of release awareness over named routes: what is running per subject, what each route's authority wants, what a provider has prepared, and the operation it is carrying out. It never claims an installation nobody observed, and only misconfiguration and use after disposal throw.
- Three entries, and no name is exported by two of them. The root, `@priemskiyyy/beacon`, is what an application imports: `Beacon`, `targetRoute`, `newerRoute`, `supportPolicy`, `minimumBuild`, `createBootId`, `keyValueJournalStorage` and the types its snapshots, observations, offers and outcomes are made of. `@priemskiyyy/beacon/adapter` is for the author of a source, a mechanism or a driver: `createReleaseSource`, `createUpdateMechanism`, `createReleaseDriver`, `parseUtcTimestamp`, the identity domain words and the contexts, drafts and results those take. `@priemskiyyy/beacon/versions` has `semver`, `integer` and `custom`, which compare exactly beyond the safe integer range, and the version types.
- Identity is compared by authority and domain first, and an unknown identity equals nothing. Selection is pure: `targetRoute` offers a replacement whatever its order, `newerRoute` offers only what orders newer under a version strategy, and an `inconclusive` observation says why in its `detail`. Evidence carries its source, origin, receipt time, expiry and revision; a failed check never erases what was accepted, a lower revision, a conflict and another epoch are rejected, and a renewal refreshes evidence without a new offer.
- One shared read per source, with joined callers, one trailing read, timeouts and session fencing. One `check()` waits once for the running facts it needs and then starts every route and the support policy in the same turn.
- A route's subject comes from its mechanism, and `running` is optional: a feed route needs a reader for its subject, a driver route may supply a default one, and the default boot id is minted once per JavaScript runtime, so a Fast Refresh is the same boot. A reader is given the scope of the read and, typed with its subject, cannot be put in another subject's slot. `new Beacon` throws `INVALID_CONFIGURATION` for a feed route whose subject has no reader.
- Each route gets one typed method per command, with the reference, parameters and receipt that command declares. A command takes the offer or the prepared target itself, and settles as `accepted`, `blocked`, `stale`, `unsupported`, `cancelled`, `failed` or `indeterminate`, never a rejection. A forged reference, a copy of one and one of another route are refused with their own reasons.
- Disruption coordination: a participant is a `name` and a `reserve`, asked before every impact that loses in-memory state unless it lists `impacts`; participants reserve, settle and are checked again before a provider is asked, one operation runs per route and one disruptive operation across routes, an identical call joins and a conflicting one is blocked, a caller's abort after a dispatch is `indeterminate`, and a command that replaces the realm leaves its route unresolved until `route.acknowledge()`.
- Support: `supportPolicy({ source, evaluate })` and the forced upgrade `minimumBuild({ source })` evaluate a policy against what is running, and `beacon.support` publishes the status, the last evaluation, the routes that would satisfy it and whether each is usable. A policy that lapses is `unknown` with its last decision kept, a policy source that failed to read says `read-failed`, and a build the `native` fact does not name is `unknown`, never a guess.
- Transition journal, off by default or `best-effort` or `required` over an injected `JournalStorage` or a key-value store such as AsyncStorage, `expo-sqlite/kv-store` or `localStorage`. An intent is written before a command that replaces the realm and read back by the next boot as `target-running`, `target-not-running`, `different-target`, `inconclusive` or `same-boot`, with the attempts that left a target unreached, whether the budget is spent and `judgedHere`. A required write that fails stops the command, a storage that does not answer in `timeouts.journal` counts as failed, a corrupt, future or far-expiring record is ignored, and `beacon.reportReady()` and `beacon.clearJournal()` are the application's.
- Scopes: `ReleaseScope` can name an account with `partition`, and `beacon.replaceScope(next)` puts another scope in force, fencing the results of the old one. A driver names the native manager it holds with `exclusive`, so a second session cannot open it.
- Diagnostics are passive. A failure event carries the raw value that was thrown as `cause`, built only while a listener is subscribed and never in a snapshot, an outcome or a counter, so a listener that forwards events to telemetry must drop it. Failure messages say which case they are, and a call outside a session fails with `NOT_STARTED` and what to do about it.
- Every observable has `getInitial()`, its value before any session, which is what a server renders and a hydrating render reads. `beacon.routeNames`, `beacon.clock` and `createBootId()` (which works on Hermes without a polyfill) complete the surface.
- `@priemskiyyy/beacon/triggers` has `checkOn(beacon, { triggers })`, which checks on startup, a return from the background, a network that came back, an interval and a push, through one gate that shares reads, holds a burst to one start, backs off after a failure and labels a check `startup`, `foreground`, `reconnect`, `interval`, `invalidation`, `retry` or `expiry`. It is structural and imports no SDK: React Native's `AppState` and NetInfo are taken as they are, a Pulse and a Reach condition are the other inputs, and its timers are the Beacon's clock. `@priemskiyyy/beacon/triggers/browser` has `foreground()` and `reconnect()` for the document and the window and installs nothing without one.
- `@priemskiyyy/beacon/mock` has `createMockSource`, `createTestClock`, `createMockJournalStorage`, `createGate` and `settle`; `@priemskiyyy/beacon/testing` has the conformance suites `testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism`, `testReleaseDriver`, `testRunningReader` and `testJournalStorage`. The suites need Vitest.
- What is not built yet is listed in `docs/decisions.md`.

## @priemskiyyy/beacon-http 0.1.0 - Unreleased

- First release. `http({ fetch })` turns the application's client call into a release source. The client validates the response and resolves `changed` with the document and its evidence, or `not-modified`, which renews the document held for the scope with the new expiry when the backend gave one.
- `readStandardManifest` and `parseStandardManifest` are the optional standard manifest: a response or its text becomes a typed document for the routes the application declares, or a `BeaconError` that names the rule it broke. An account's answers stay apart through `partition` in the scope.
- `standardManifestSource({ url, routes, fetch?, headers? })` reads a standard manifest at a URL as a release source: the global `fetch` (or yours) with `cache: "no-cache"`, the `ETag` sent back as `If-None-Match`, the scope passed, the time read from the Beacon's clock, and a redirect, an error status and a login page refused. `http` hands its client the Beacon's `clock`, and an answer that returns only a `document` is a changed answer.
- The standard manifest needs only `schemaVersion` and `routes`: `issuedAt`, `expiresAt`, `decisionRevision` and the four scope fields are optional and judged whenever present, and a release's `identity` may be a text, known under `scope.application` and the `domain` its route declares (`web-artifact` for a `target` route). Evidence with no `expiresAt` of its own holds for the client's window, `limits.lifetime` from the read, and a `304` or a fresh read starts it again (`holdsFor`); see `docs/decisions.md` for the departure from the specification.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-browser 0.1.0 - Unreleased

- First release. `browserReload()` is a mechanism with one command, `reload`, bound to nothing: the next navigation receives whatever is deployed. Without a window it is unsupported.
- `webBuild({ id, label?, authority?, domain? })` reads the running web build from the id a bundler injects, such as `import.meta.env.VITE_BUILD_ID`, under the application of the scope (the reader is given the scope each time it runs, and `authority` overrides it), in the domain `web-artifact`, and is made for the `web` subject (`running.bundle` refuses it): an id that was never defined, which compiles to `undefined` or an empty string or is written as the text `undefined`, is an unknown identity with the reason `build-id-not-injected`, never a build named `undefined`.
- `webRelease({ authority, id, label })` makes the `Release` that `webBuild` reads back when that build runs, so a custom web source names its build without an identity written by hand; it refuses an id nobody defined with `INVALID_CONFIGURATION`, since a release cannot be unknown. Its `authority` stays required, since a `select` is given the document and not the scope: pass the `scope.application` that `webBuild` uses.
- `browserStorage({ area, target, verify })` keeps the journal in the tab's `sessionStorage`, or in `localStorage` with `area: "local"`, over `keyValueJournalStorage`. It reaches the storage at each call and touches nothing when it is made: a server render, a frame that blocks site data (the `SecurityError` is the cause) and a full storage each reject that call.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-service-worker 0.1.0 - Unreleased

- First release. `serviceWorker()` reports a waiting worker next to an active one as an update that is ready, with the release unknown, `activate` asks it to skip waiting, and once the active worker was replaced `reload` reloads the document.
- It never registers or unregisters a worker, and activating one reaches every tab of the scope.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-expo 0.1.0 - Unreleased

- First release. `expoUpdates({ updates })` maps the whole check result, including a rollback to the embedded update, and never reports a rejection or disabled updates as no update. `download` says whether what the provider prepared is the offer, and `reload` restarts the runtime. `expoBundle({ updates })` reads the running update, and takes the module in an object as `expoUpdates` does. It is made for the `bundle` subject (`running.web` refuses it), and `expoUpdates` supplies it as the reader of its own subject, so a journal knows which update a reload reached with no `running.bundle`; a reader the application passes wins.
- `applyUpdate(route)` runs `download` and then `reload` for an Expo route, never throws, and answers where it stopped and how that command settled (`none`, `download` or `reload`), with the accepted download beside the reload so its `offered` receipt is visible. It reloads an update that an earlier download prepared when nothing is on offer any more.
- `@priemskiyyy/beacon-expo/mock` has `createFakeUpdates({ available?, disabled? })`, a fake `expo-updates` module for Jest and for seeing the banner in Expo Go, with a count of the calls it received.
- `expoApplication({ application })` reads the installed binary as the `native` running fact, from `expo-application`: an Android build is its version code in the domain `android-version-code` and an iOS build its build number in `ios-build`, the words the Play adapter offers in and the App Store adapter reads (`raw.shortVersion`). The platform is `scope.platform` (`"ios"` or `"android"`; any other is unknown with the reason `unsupported-platform`, and the module is not asked) and the authority is `scope.application`, so a binary of another application, such as Expo Go, is unknown as `another-application` and keeps none of its version numbers; `platform`, `authority` and `domain` override them. A build the module did not give is an unknown identity with the reason `build-not-read` or `application-not-read`, never a build named null.
- Requires `@priemskiyyy/beacon` 0.1, `expo-updates` 0.24 or later and, for `expoApplication`, `expo-application` 5.0.0 or later, whose types were checked up to 58.

## @priemskiyyy/beacon-google-play 0.1.0 - Unreleased

- First release. `googlePlay({ bridge })` maps Play's four query categories and runs the flexible flow to a prepared download, the immediate flow, and the completion, each reconfirming the offer first.
- `playStore({ applicationId, linking })` is a route with `openStore` and no bridge: it opens `market://details?id=` and, where nothing handles it, the web page of the store. It has the shape of the App Store route's `openStore`, so one route name serves both stores, and it offers nothing.
- `openStore` of `playStore` is unsupported with the reason `other-distribution`, and opens nothing, for a scope whose `distribution` is not `google-play`, which the package exports as `GOOGLE_PLAY_DISTRIBUTION`.
- `googlePlay({ bridge })` is documented as needing a native bridge you write, which no package ships.
- Requires `@priemskiyyy/beacon` 0.1, and a native bridge that keeps the `PlayBridge` contract for `googlePlay` only.

## @priemskiyyy/beacon-code-push 0.1.0 - Unreleased

- First release. `codePushUpdates({ codePush })` maps the React Native CodePush family (Microsoft, Revopush, Bravemobile and AppZung): no package is `none` with the detail `no-package-for-binary`, never up to date, `download` installs for the next start and is accepted once CodePush lists the package as pending, `reload` only requests a restart, and `codePushBundle({ codePush })` reads the running package, taking the module in an object as the route does, and is made for the `bundle` subject: `codePushUpdates` supplies it as the reader of its own subject, so a journal knows which package a reload reached with no `running.bundle`, and a reader the application passes wins. Requires `@priemskiyyy/beacon` 0.1 and one of the four packages, each from the oldest release whose types were checked: `react-native-code-push` 8.0, `@revopush/react-native-code-push` 1.0, `@bravemobile/react-native-code-push` 8.2.3 and `@appzung/react-native-code-push` 10.

## @priemskiyyy/beacon-app-store 0.1.0 - Unreleased

- First release. `appStoreLookup` reads Apple's lookup shape through your client as an advisory marketing-release source, `appStoreHandoff` opens the store page, and `appleVersion` orders marketing versions.
- `appStoreLookup` answers no release, with no request, for a scope whose distribution is not `app-store`, and refuses a lookup that breaks its contract as `INVALID_DOCUMENT`, as the standard manifest does.
- `appStore({ appId, country, bundleId?, linking, fetch? })` is the whole route: the lookup, the order of marketing versions and the handoff. Without a `fetch` it asks Apple's lookup through the global `fetch`, refusing a failing status and a redirect where the response can say it, and reading the JSON into the entries the source needs.
- `openStore` of the handoff is unsupported with the reason `other-distribution`, and opens nothing, for a scope whose `distribution` is not `app-store`, which the package exports as `APP_STORE_DISTRIBUTION`.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-firebase-remote-config 0.1.0 - Unreleased

- First release. `firebaseRemoteConfig({ remoteConfig, sdk, document })` fetches and activates Remote Config on the web or in React Native and builds a document from what the server sent, dated by the fetch that got it, and never from a default, a missing key or a configuration that never fetched.
- Requires `@priemskiyyy/beacon` 0.1 and the SDK you pass in: `@react-native-firebase/remote-config` 25 or later, or `firebase` 9.8.3 or later, whose types were checked up to 26 and 12.

## @priemskiyyy/beacon-device-info 0.1.0 - Unreleased

- First release. `deviceInfo({ deviceInfo })` reads the installed binary as the `native` running fact, from `react-native-device-info`: an Android build is its version code in the domain `android-version-code` and an iOS build its build number in `ios-build`, the words the Play adapter offers in and the App Store adapter reads (`raw.shortVersion`). The platform is `scope.platform` (`"ios"` or `"android"`; any other is unknown with the reason `unsupported-platform`, and the library is not asked) and the authority is `scope.application`; `platform`, `authority` and `domain` override them. A build the library did not give, which it answers as the text `unknown`, is an unknown identity with the reason `build-not-read` or `application-not-read`, never a build named null, and a binary of another application, such as Expo Go, is unknown as `another-application` and keeps none of its version numbers. It is made for the `native` subject. `expoApplication` is in `@priemskiyyy/beacon-expo`.
- Requires `@priemskiyyy/beacon` 0.1. `react-native-device-info` 10.0.0 or later is an optional peer dependency, whose types were checked up to 15.

## @priemskiyyy/beacon-react 0.1.0 - Unreleased

- First release. `BeaconProvider` and the hooks `useRoute`, `useRunning`, `useSupport`, `useTransitions`, `useBeaconStatus`, `useObservable`, `useDisruption` and `useBeacon`, typed by the `Register`ed Beacon so a route is read by its name. Reading starts nothing, and the server and the hydrating render read state as it stands before any session.
- `BeaconProvider` opens the observation session while it is mounted and ends it on unmount, and `start={false}` leaves the session to the application. The Vue, Solid and Svelte providers do the same.
- Without a `Register`, the provider takes any Beacon and the hooks that name no route work. A hook that takes a route name fails to compile with the fix as the type it expected, `Register your Beacon: declare module ...`.
- A hook, composable, primitive or utility used outside a provider throws `INVALID_CONFIGURATION` naming what was called and the package that has the provider, such as `useRoute needs a BeaconProvider (from @priemskiyyy/beacon-react) above it.`
- Requires `@priemskiyyy/beacon` 0.1 and React 18.3 to 19. The tests run against React 18.3 and 19.2.

## @priemskiyyy/beacon-solid 0.1.0 - Unreleased

- First release. The same `BeaconProvider` and primitives as the React binding, read as accessors: a route is read by its name from the `Register`ed Beacon, and the server and the hydrating render read state as it stands before any session.
- Requires `@priemskiyyy/beacon` 0.1 and Solid 1.9.

## @priemskiyyy/beacon-vue 0.1.0 - Unreleased

- First release. The same `BeaconProvider` and composables as the React binding, read as computed refs: a route is read by its name from the `Register`ed Beacon, and the server and the hydrating render read state as it stands before any session.
- Requires `@priemskiyyy/beacon` 0.1 and Vue 3.5.

## @priemskiyyy/beacon-svelte 0.1.0 - Unreleased

- First release. The same `BeaconProvider` and utilities as the React binding, read through `current` on Svelte 5 runes: a route is read by its name from the `Register`ed Beacon, and the server and the hydrating render read state as it stands before any session.
- Requires `@priemskiyyy/beacon` 0.1 and Svelte 5.7.

## @priemskiyyy/beacon-devtools 0.1.0 - Unreleased

- First release. `BeaconDevtools` is a framework-independent inspector in a shadow root, with its own Solid runtime bundled in: it shows the session, every route with its evidence, what runs, support, the journal and a timeline of the diagnostic events. It starts nothing, calls no command, hides raw values and provider handles until asked, and always redacts secret-looking property names. `@priemskiyyy/beacon-devtools/react` reads the Beacon from the provider.
- It is for the web: it mounts into a DOM element and keeps its state in `localStorage`, so a React Native app logs `beacon.diagnostics.events` instead.
- A failure event's row shows what it threw: an error by its class, message, own fields and cause, cut to a limit, with secret-named properties replaced.
- Requires `@priemskiyyy/beacon` 0.1. The React wrapper also needs `@priemskiyyy/beacon-react` 0.1 and React 19.2.
