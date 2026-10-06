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
- Transition journal: off by default, or `best-effort` or `required` over an injected `JournalStorage`. An intent is written before a command that replaces the realm and read back by the next boot as `target-running`, `target-not-running`, `different-target`, `inconclusive` or `same-boot`, with the attempts that left a target unreached and whether the budget is spent. A required write that fails stops the command, a corrupt or future record is ignored, the history is bounded, and `beacon.reportReady()` and `beacon.clearJournal()` are the application's.
- `ReleaseScope` can name an account with `partition`, which every source read and journal record is kept apart by.
- `beacon.replaceScope(next)` puts another scope in force: results of the old scope are fenced, what it taught is forgotten, running facts stay, and a route with an operation running or unresolved blocks it.
- A driver can name the native manager it holds with `exclusive`, so a second session cannot open it. `testReleaseSource` takes the scope a source speaks for.
- Every observable has `getInitial()`, its value before any session, which is what a server renders and what a hydrating render must read. `beacon.routeNames` lists the routes, and `RouteSnapshotOf` names a route's state type.
- One `check()` waits once for the running facts it needs and then starts the read of every route and of the support policy in the same turn, so a source they share is read once however fast it answers.
- Not built yet: the scheduler. See `docs/decisions.md`.

## @priemskiyyy/beacon-http 0.1.0 - Unreleased

- First release. `http({ request })` turns the application's client call into a release source. The client validates the response and resolves `changed` with the document and its evidence, or `not-modified`, which renews the document held for the scope with the new expiry when the backend gave one.
- `readStandardManifest` and `parseStandardManifest` are the optional standard manifest: a response or its text becomes a typed document for the routes the application declares, or a `BeaconError` that names the rule it broke. An account's answers stay apart through `partition` in the scope.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-browser 0.1.0 - Unreleased

- First release. `browserReload()` is a mechanism with one command, `reload`, bound to nothing: the next navigation receives whatever is deployed. Without a window it is unsupported.
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

## @priemskiyyy/beacon-app-store 0.1.0 - Unreleased

- First release. `appStoreLookup` reads Apple's lookup shape through your client as an advisory marketing-release source, `appStoreHandoff` opens the store page, and `appleVersion` orders marketing versions.
- `appStoreLookup` answers no release, with no request, for a scope whose distribution is not `app-store`.
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
