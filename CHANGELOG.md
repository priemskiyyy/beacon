# Changelog

## @priemskiyyy/beacon 0.1.0 - Unreleased

- First release. `Beacon` keeps one model of release awareness over named routes: what is running per subject, what each route's authority wants, what a provider has prepared, and the operation it is carrying out.
- Identity is compared by authority and domain first, and an unknown identity equals nothing. Selection is pure: `targetRoute` offers a replacement whatever its order, `newerRoute` offers only what orders newer under a version strategy, and each explains a refusal.
- Evidence carries its source, origin, receipt time, expiry and revision. A failed check never erases what was accepted; a lower revision, a conflict and another epoch are rejected; a renewal refreshes evidence without a new offer.
- `@priemskiyyy/beacon/versions` has `semver`, `integer` and `custom`, comparing exactly beyond the safe integer range.
- One shared read per source, with joined callers, one trailing read, timeouts and session fencing. A source read once selects for all its routes in one transaction.
- Each route gets one typed method per command, with the reference, parameters and receipt that command declares. Commands settle as `accepted`, `blocked`, `stale`, `unsupported`, `cancelled`, `failed` or `indeterminate`, and never reject.
- Disruption coordination: participants reserve, settle and are checked again before a provider is asked; one operation per route and one disruptive operation across routes; an identical call joins, a conflicting call is blocked; a caller's abort after a dispatch is `indeterminate`; a command that replaces the realm leaves its route unresolved until `route.acknowledge()`.
- Passive diagnostics, and `createMockSource`, `createTestClock` under `./mock`, and `testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism` and `testReleaseDriver` under `./testing`.
- Errors are `BeaconError`s with a `code`. Only misconfiguration and use after disposal throw.
- Support: `supportPolicy({ source, evaluate })` evaluates the application's own policy against what is running, and `beacon.support` publishes the status, the last evaluation, the routes that would satisfy it and whether each is usable. A policy that lapses is unknown with its last decision kept, a failing evaluation keeps the last valid one in force beside the error, and a route the Beacon does not have cannot be named.
- Transition journal: off by default, or `best-effort` or `required` over an injected `JournalStorage`. An intent is written before a command that replaces the realm and read back by the next boot as `target-running`, `target-not-running`, `different-target`, `inconclusive` or `same-boot`, with the attempts that left a target unreached and whether the budget is spent. A required write that fails stops the command, a call the storage does not answer within `timeouts.journal` (10 seconds by default) counts as failed, a corrupt or future record is ignored, the history is bounded, and `beacon.reportReady()` and `beacon.clearJournal()` are the application's.
- `ReleaseScope` can name an account with `partition`, which every source read and journal record is kept apart by.
- `beacon.replaceScope(next)` puts another scope in force: results of the old scope are fenced, what it taught is forgotten, running facts stay, and a route with an operation running or unresolved blocks it.
- A driver can name the native manager it holds with `exclusive`, so a second session cannot open it. `testReleaseSource` takes the scope a source speaks for.
- `SelectorOptions` is the core's `{ isEqual }` type, which every framework binding re-exports.
- Every observable has `getInitial()`, its value before any session, which is what a server renders and what a hydrating render must read. `beacon.routeNames` lists the routes, and `RouteSnapshotOf` names a route's state type.
- One `check()` waits once for the running facts it needs and then starts the read of every route and of the support policy in the same turn, so a source they share is read once however fast it answers.
- `beacon.clearJournal()` also recovers a journal whose first read failed: once the record is removed the journal is `ready` and a command that replaces the realm writes again, without a `stop()` and a `start()`.
- `createBootId()` makes the boot id: a version 4 UUID from `crypto.randomUUID`, else `crypto.getRandomValues`, else `Math.random`, so it works on Hermes without a polyfill. It never throws and never reads the clock.
- `beacon.clock` is the `BeaconClock` the Beacon runs on, read only, so an integration that schedules beside it reads the time and arms its timers on the clock a test clock replaces.
- `parseUtcTimestamp(text)` reads a UTC timestamp such as `2026-09-27T10:00:00.5Z` to epoch milliseconds, or `undefined` for text that is not one or names a date that does not exist, the same on Hermes as on V8.
- `createGate()` and `settle()` under `./mock` fake a provider that answers later: a gate is open until the test holds it, and `release()` lets every waiter go.
- `keyValueJournalStorage(store, { verify, key })` adapts any store with `getItem`, `setItem` and `removeItem`, such as AsyncStorage, `expo-sqlite/kv-store`, MMKV through a recipe, `localStorage` and `sessionStorage`, to the journal's storage: a call that throws at once is a rejection, a write is read back, and a journal key can be mapped to the store's own. `createMockJournalStorage()` under `./mock` is an in-memory journal storage with `records`, call counts, and knobs to hold and to refuse reads and writes, and `testJournalStorage({ name, create })` under `./testing` holds a storage to the contract.
- `testRunningReader({ name, create, situations })` under `./testing` holds a running reader to the contract: it asks its host for nothing until read, answers a release with a known identity that has no empty part or space around it or an unknown one with a reason, answers the same release on every read, and answers an unknown identity or rejects where its host cannot name what runs.
- Not built yet: the scheduler. See `docs/decisions.md`.

## @priemskiyyy/beacon-http 0.1.0 - Unreleased

- First release. `http({ fetch })` turns the application's client call into a release source. The client validates the response and resolves `changed` with the document and its evidence, or `not-modified`, which renews the document held for the scope with the new expiry when the backend gave one.
- `readStandardManifest` and `parseStandardManifest` are the optional standard manifest: a response or its text becomes a typed document for the routes the application declares, or a `BeaconError` that names the rule it broke. An account's answers stay apart through `partition` in the scope.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-browser 0.1.0 - Unreleased

- First release. `browserReload()` is a mechanism with one command, `reload`, bound to nothing: the next navigation receives whatever is deployed. Without a window it is unsupported.
- `webBuild({ authority, id, label, domain })` reads the running web build from the id a bundler injects, such as `import.meta.env.VITE_BUILD_ID`, in the domain `web-artifact`: an id that was never defined, which compiles to `undefined` or an empty string or is written as the text `undefined`, is an unknown identity with the reason `build-id-not-injected`, never a build named `undefined`.
- `browserStorage({ area, target, verify })` keeps the journal in the tab's `sessionStorage`, or in `localStorage` with `area: "local"`, over `keyValueJournalStorage`. It reaches the storage at each call and touches nothing when it is made: a server render, a frame that blocks site data (the `SecurityError` is the cause) and a full storage each reject that call.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-service-worker 0.1.0 - Unreleased

- First release. `serviceWorker()` reports a waiting worker next to an active one as an update that is ready, with the release unknown, `activate` asks it to skip waiting, and once the active worker was replaced `reload` reloads the document.
- It never registers or unregisters a worker, and activating one reaches every tab of the scope.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-expo 0.1.0 - Unreleased

- First release. `expoUpdates({ updates })` maps the whole check result, including a rollback to the embedded update, and never reports a rejection or disabled updates as no update. `download` says whether what the provider prepared is the offer, and `reload` restarts the runtime. `expoBundle` reads the running update.
- Requires `@priemskiyyy/beacon` 0.1 and `expo-updates` 57.

## @priemskiyyy/beacon-google-play 0.1.0 - Unreleased

- First release. `googlePlay({ bridge })` maps Play's four query categories and runs the flexible flow to a prepared download, the immediate flow, and the completion, each reconfirming the offer first.
- Requires `@priemskiyyy/beacon` 0.1 and a native bridge that keeps the `PlayBridge` contract.

## @priemskiyyy/beacon-code-push 0.1.0 - Unreleased

- First release. `codePushUpdates({ codePush })` maps the React Native CodePush family (Microsoft, Revopush, Bravemobile and AppZung): no package is `none` with the detail `no-package-for-binary`, never up to date, `download` installs for the next start and is accepted once CodePush lists the package as pending, `reload` only requests a restart, and `codePushBundle` reads the running package. Requires `@priemskiyyy/beacon` 0.1 and one of the four packages.

## @priemskiyyy/beacon-app-store 0.1.0 - Unreleased

- First release. `appStoreLookup` reads Apple's lookup shape through your client as an advisory marketing-release source, `appStoreHandoff` opens the store page, and `appleVersion` orders marketing versions.
- `appStoreLookup` answers no release, with no request, for a scope whose distribution is not `app-store`, and refuses a lookup that breaks its contract as `INVALID_DOCUMENT`, as the standard manifest does.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-firebase-remote-config 0.1.0 - Unreleased

- First release. `firebaseRemoteConfig({ remoteConfig, sdk, document })` fetches and activates Remote Config on the web or in React Native and builds a document from what the server sent, dated by the fetch that got it, and never from a default, a missing key or a configuration that never fetched.
- Requires `@priemskiyyy/beacon` 0.1 and the SDK you pass in: `@react-native-firebase/remote-config` 26 or `firebase` 12.

## @priemskiyyy/beacon-native 0.1.0 - Unreleased

- First release. `expoApplication({ application, platform, authority })` and `deviceInfo({ deviceInfo, platform, authority })` read the installed binary as the `native` running fact, from `expo-application` and from `react-native-device-info`: an Android build is its version code in the domain `android-version-code` and an iOS build its build number in `ios-build`, the words the Play adapter offers in and the App Store adapter reads (`raw.shortVersion`). A build the SDK did not give, which `react-native-device-info` answers as the text `unknown`, is an unknown identity with the reason `build-not-read` or `application-not-read`, never a build named null, and a binary of another application, such as Expo Go, is unknown as `another-application` and keeps none of its version numbers.
- Requires `@priemskiyyy/beacon` 0.1. `expo-application` 57 and `react-native-device-info` 15 are optional peer dependencies.

## @priemskiyyy/beacon-triggers 0.1.0 - Unreleased

- First release. `checkOn(beacon, { triggers })` checks a Beacon on startup, a return from the background, a network that came back, an interval and a push, through one gate that shares reads, holds a burst to one start and backs off after a failure. React Native's `AppState` and NetInfo are taken as they are, a Pulse and a Reach condition are the other inputs, and nothing is subscribed before `checkOn`.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-react 0.1.0 - Unreleased

- First release. `BeaconProvider` and the hooks `useRoute`, `useRunning`, `useSupport`, `useTransitions`, `useStatus`, `useObservable`, `useDisruption` and `useBeacon`, typed by the `Register`ed Beacon so a route is read by its name. Reading starts nothing, and the server and the hydrating render read state as it stands before any session.
- Requires `@priemskiyyy/beacon` 0.1 and React 19.2.

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
- Requires `@priemskiyyy/beacon` 0.1. The React wrapper also needs `@priemskiyyy/beacon-react` 0.1 and React 19.2.
