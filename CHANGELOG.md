# Changelog

## @priemskiyyy/beacon 0.1.0 - Unreleased

- First release. `Beacon` keeps one model of release awareness over named routes: what is running per subject, what each route's authority wants, what a provider has prepared, and the operation it is carrying out.
- Identity is compared by authority and domain first, and an unknown identity equals nothing. Selection is pure: `targetRoute` offers a replacement whatever its order, `newerRoute` offers only what orders newer under a version strategy, and each explains a refusal.
- Evidence carries its source, origin, receipt time, expiry and revision. A failed check never erases what was accepted; a lower revision, a conflict and another epoch are rejected; a renewal refreshes evidence without a new offer.
- `@priemskiyyy/beacon/versions` has `semver`, `integer` and `custom`, comparing exactly beyond the safe integer range.
- One shared read per source, with joined callers, one trailing read, timeouts and session fencing. A source read once selects for all its routes in one transaction.
- An `inconclusive` observation carries a `detail` that says why: for `missing-current-identity` the running reader's own reason, such as `build-id-not-injected`, or `running-pending` while the reader has not answered yet and `running-failed` once it failed; for `incomparable-identity` the authority or domain that differs with the running and the offered word of each, or the offered identity that is unknown; `missing-current-order` says `running-pending` or `running-failed` when the running release is not there. The other order reasons have none. Devtools shows it.
- Each route gets one typed method per command, with the reference, parameters and receipt that command declares. Commands settle as `accepted`, `blocked`, `stale`, `unsupported`, `cancelled`, `failed` or `indeterminate`, and never reject.
- A command takes the offer or the prepared target itself: `route.reload({ offer: observation.offer })` and `{ prepared: prepared.value }`, as well as their `ref`, which is what the core reads. A copy of a reference, a forged one and one of another route are still refused with their own reasons.
- Disruption coordination: participants reserve, settle and are checked again before a provider is asked; one operation per route and one disruptive operation across routes; an identical call joins, a conflicting call is blocked; a caller's abort after a dispatch is `indeterminate`; a command that replaces the realm leaves its route unresolved until `route.acknowledge()`.
- A participant's `impacts` is optional: left out, it is asked before every impact that loses in-memory state (`document-replacement`, `javascript-restart`, `native-update-flow`, `worker-takeover`, `external-handoff`), so the shortest guard is a `name` and a `reserve`. An empty list throws `INVALID_CONFIGURATION` when the participant registers. A `reserved` answer's `resume` (the function that reopens admission) is optional.
- Passive diagnostics, and `createMockSource`, `createTestClock` under `./mock`, and `testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism` and `testReleaseDriver` under `./testing`.
- `BeaconDiagnosticEvent.cause` is the raw value a failure threw, `null` when nothing was thrown, on `read-failed`, `running-failed`, `route-failed`, `policy-failed`, `journal-failed` and `command-settled` for a command that failed. It is built only while a listener is subscribed and never reaches a snapshot, an outcome, a counter or an error's published info; a listener that forwards events to telemetry must drop it.
- Failure messages say which case they are. `DRIVER_FAILED` says the provider threw while it was checked, answered what is no observation, threw when it opened, or is not open because another Beacon session holds its native module (the last two are also a `route-failed` event at `start()`, with the cause); `SELECTION_FAILED` says the select function of the route threw; the `SOURCE_FAILED` default points at `beacon.diagnostics.events`.
- Errors are `BeaconError`s with a `code`. Only misconfiguration and use after disposal throw. `beacon.route(name)` with a name that was never defined throws `INVALID_CONFIGURATION` and lists the routes the Beacon has.
- A command that finds its provider closed fails with the reason a check gives, `DRIVER_FAILED` with "The provider is not open: its native module is held by another Beacon session" or "it threw while it opened", where it said only that the provider is not open; a mechanism of a feed route that threw while it opened says the second.
- A call outside a session fails with `NOT_STARTED` and a message that says what to do: the Beacon has no open session, so call `beacon.start()` or mount a `BeaconProvider` that is not given `start={false}`.
- Support: `supportPolicy({ source, evaluate })` evaluates the application's own policy against what is running, and `beacon.support` publishes the status, the last evaluation, the routes that would satisfy it and whether each is usable. A policy that lapses is unknown with its last decision kept, a failing evaluation keeps the last valid one in force beside the error, and a route the Beacon does not have cannot be named.
- `beacon.support` says `unknown` with the reason `read-failed` and the error when the last read of the policy's source failed and nothing is in force, because none was accepted or the accepted one lapsed; the last valid evaluation, if there is one, stays beside it as for `expired`. `not-checked` now means only that no check has run.
- Transition journal: off by default, or `best-effort` or `required` over an injected `JournalStorage`. An intent is written before a command that replaces the realm and read back by the next boot as `target-running`, `target-not-running`, `different-target`, `inconclusive` or `same-boot`, with the attempts that left a target unreached and whether the budget is spent. A required write that fails stops the command, a call the storage does not answer within `timeouts.journal` (10 seconds by default) counts as failed, a corrupt or future record is ignored, the history is bounded, and `beacon.reportReady()` and `beacon.clearJournal()` are the application's.
- `journal.mode` defaults to `best-effort`, and `journal.storage` takes a key-value store with `getItem`, `setItem` and `removeItem`, such as AsyncStorage, `expo-sqlite/kv-store` or `localStorage`, as it is: Beacon wraps it with `keyValueJournalStorage` and its read-back of every write, which stays exported for `verify` and `key`. `beacon.transitions.get().latest.judgedHere` is true only in the boot that judged the intent, so a banner says "Updated." once; it lives in memory and adds nothing to the record. `budget`, `retention` and `exhausted` stay, since the journal's rows prove them, and the docs list them as advanced.
- `ReleaseScope` can name an account with `partition`, which every source read and journal record is kept apart by.
- `beacon.replaceScope(next)` puts another scope in force: results of the old scope are fenced, what it taught is forgotten, running facts stay, and a route with an operation running or unresolved blocks it.
- A driver can name the native manager it holds with `exclusive`, so a second session cannot open it. `testReleaseSource` takes the scope a source speaks for.
- `SelectorOptions` is the core's `{ isEqual }` type, which every framework binding re-exports.
- Every observable has `getInitial()`, its value before any session, which is what a server renders and what a hydrating render must read. `beacon.routeNames` lists the routes, and `RouteSnapshotOf` names a route's state type.
- One `check()` waits once for the running facts it needs and then starts the read of every route and of the support policy in the same turn, so a source they share is read once however fast it answers.
- `beacon.clearJournal()` also recovers a journal whose first read failed: once the record is removed the journal is `ready` and a command that replaces the realm writes again, without a `stop()` and a `start()`.
- `createBootId()` makes the boot id: a version 4 UUID from `crypto.randomUUID`, else `crypto.getRandomValues`, else `Math.random`, so it works on Hermes without a polyfill. It never throws and never reads the clock.
- A route's subject comes from its mechanism: `createUpdateMechanism({ name, subject, open, commands })` names the running subject its commands replace (`browserReload()` is `web`, `appStoreHandoff` is `native`), and `targetRoute` and `newerRoute` take no `subject`, so a mechanism and a reader cannot disagree about what is replaced.
- `running` is optional, and so is `running.boot`: the default boot id is minted once per JavaScript runtime and shared by every Beacon made in it, so a Fast Refresh that makes the Beacon again is the same boot. `boot: { id }` still chooses it, as a test does.
- A running reader is given the scope of the read, `(context: { scope }) => ...` (`RunningReaderContext`), and the new scope after `replaceScope`; a reader with no parameter still fits. `testRunningReader` reads under a frozen scope, takes the `scope` the reader is meant for, and a situation may give its own.
- `RunningReader<"web">` can carry the subject it was made for, so `running: { web: bundleReader }` does not compile, and a function of your own fits any subject.
- `new Beacon` throws `INVALID_CONFIGURATION` for a feed route whose subject has no reader in `running`, which could never offer anything, and for two driver routes that each supply the reader of one subject.
- The core exports the three identity domain words the ecosystem agrees on, `ANDROID_VERSION_CODE_DOMAIN`, `IOS_BUILD_DOMAIN` and `WEB_ARTIFACT_DOMAIN`, so an adapter imports them instead of spelling them.
- `minimumBuild({ source, authority, remediation, level })` is the forced upgrade as a support policy: the native build is `unsupported` below the minimum, with the store route you name, and `unknown`, never a guess, when the `native` fact is not read (`native-build-not-read`), is unknown, named in another domain or of another authority (`native-build-unreadable`). It compares as integers for an Android version code and an iOS build number alike, and a dotted `1.2.0` fails the policy with `INVALID_VERSION`.
- The `NOT_STARTED` message says what to do: the Beacon has no open session, so call `beacon.start()` or mount a `BeaconProvider` that is not given `start={false}`.
- A driver route may supply the default reader of its own subject with `createReleaseDriver({ running })`, used only when `running` has none for that subject: the application's reader always wins, and a driver never writes a fact.
- `beacon.clock` is the `BeaconClock` the Beacon runs on, read only, so an integration that schedules beside it reads the time and arms its timers on the clock a test clock replaces.
- `parseUtcTimestamp(text)` reads a UTC timestamp such as `2026-09-27T10:00:00.5Z` to epoch milliseconds, or `undefined` for text that is not one or names a date that does not exist, the same on Hermes as on V8.
- `createGate()` and `settle()` under `./mock` fake a provider that answers later: a gate is open until the test holds it, and `release()` lets every waiter go.
- `keyValueJournalStorage(store, { verify, key })` adapts any store with `getItem`, `setItem` and `removeItem`, such as AsyncStorage, `expo-sqlite/kv-store`, MMKV through a recipe, `localStorage` and `sessionStorage`, to the journal's storage: a call that throws at once is a rejection, a write is read back, and a journal key can be mapped to the store's own. `createMockJournalStorage()` under `./mock` is an in-memory journal storage with `records`, call counts, and knobs to hold and to refuse reads and writes, and `testJournalStorage({ name, create })` under `./testing` holds a storage to the contract.
- `testRunningReader({ name, create, situations })` under `./testing` holds a running reader to the contract: it asks its host for nothing until read, answers a release with a known identity that has no empty part or space around it or an unknown one with a reason, answers the same release on every read, and answers an unknown identity or rejects where its host cannot name what runs.
- `CheckReason` also says `retry`, a check that follows a failed one, and `expiry`, a recheck because evidence expired, and the `check-started` diagnostic carries either.
- A mechanism's `open` is given `{ scope }`, the scope of its session (`MechanismContext`), so a command can depend on it, as a store handoff does on the distribution.
- A source read is given `clock`, the `BeaconClock` the Beacon runs on, so a source that dates its answer reads the time from it after the response arrived, and a test clock moves it with everything else.
- What is not built yet is listed in `docs/decisions.md`.

- `@priemskiyyy/beacon/triggers` has `checkOn(beacon, { triggers })`, which checks a Beacon on startup, a return from the background, a network that came back, an interval and a push, through one gate that shares reads, holds a burst to one start and backs off after a failure. It is a subpath of the core, structural, side-effect free and importing no SDK: React Native's `AppState` and NetInfo are taken as they are, a Pulse and a Reach condition are the other inputs, and nothing is subscribed before `checkOn`. Its timers are the Beacon's clock.
- `checkOn` checks once each time a session opens, including the one `replaceScope` starts, with no trigger to list for it; `startup: false` opts out. There is no `startup()` trigger factory: there is one way to ask for the first check.
- `@priemskiyyy/beacon/triggers/browser` has `foreground({ target?, minAway? })`, which checks when a hidden tab is shown or the browser restores the page from the back-forward cache and pauses an `interval` while the tab is hidden, and `reconnect({ target? })`, which checks when the window fires `online` and never at startup. Both read the global `window` only when a session opens and install nothing without a browser window, in a server render or in React Native; the `online` event is run in Chromium against a real change of network. It is the one place of the core that reads a window.
- `whileFresh`, `onExpiry`, `random` and `backoff.attempts` are documented as advanced options of `checkOn`, after the ones most applications set. A check after a failure is labelled `retry` and one because evidence expired `expiry`, and a `retry` is never dropped by `whileFresh: "skip"`, which the evidence it failed to renew would otherwise do.

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
- The documentation shows the recipe for a reload the page cancels, a `beforeunload` handler that acknowledges once the prompt is answered, and warns that a service worker that precaches the app answers a reload from its cache. Both run in Chromium with real prompts and a real worker (`examples/browser-storage.spec.ts`); the adapter does not report a cancelled navigation itself.
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
- `useStatus` is `useBeaconStatus` in all four bindings.
- Requires `@priemskiyyy/beacon` 0.1 and React 18.3 to 19. The tests also ran against React 18.3.1 and 19.1.0.

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
