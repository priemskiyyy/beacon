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
- Not built yet: the transition journal and boot reconciliation, scope replacement and the scheduler. See `docs/decisions.md`.

## @priemskiyyy/beacon-http 0.1.0 - Unreleased

- First release. `http({ request })` turns the application's client call into a release source. The client validates the response and resolves `changed` with the document and its evidence, or `not-modified`, which renews the document held for the scope with the new expiry when the backend gave one.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-browser 0.1.0 - Unreleased

- First release. `browserReload()` is a mechanism with one command, `requestReload`, bound to nothing: the next navigation receives whatever is deployed. Without a window it is unsupported.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-service-worker 0.1.0 - Unreleased

- First release. `serviceWorker()` reports a waiting worker next to an active one as an update that is ready, with the release unknown, `activateWaiting` asks it to skip waiting, and once the active worker was replaced `requestReload` reloads the document.
- It never registers or unregisters a worker, and activating one reaches every tab of the scope.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-expo 0.1.0 - Unreleased

- First release. `expoUpdates({ updates })` maps the whole check result, including a rollback to the embedded update, and never reports a rejection or disabled updates as no update. `download` says whether what the provider prepared is the offer, and `requestReload` restarts the runtime. `expoBundle` reads the running update.
- Requires `@priemskiyyy/beacon` 0.1 and `expo-updates` 57.

## @priemskiyyy/beacon-google-play 0.1.0 - Unreleased

- First release. `googlePlay({ bridge })` maps Play's four query categories and runs the flexible flow to a prepared download, the immediate flow, and the completion, each reconfirming the offer first.
- Requires `@priemskiyyy/beacon` 0.1 and a native bridge that keeps the `PlayBridge` contract.

## @priemskiyyy/beacon-app-store 0.1.0 - Unreleased

- First release. `appStoreLookup` reads Apple's lookup shape through your client as an advisory marketing-release source, `appStoreHandoff` opens the store page, and `appleVersion` orders marketing versions.
- Requires `@priemskiyyy/beacon` 0.1.

## @priemskiyyy/beacon-react 0.1.0 - Unreleased

- First release. `BeaconProvider`, `useRoute`, `useRunning`, `useSupport`, `useDisruption` and `useBeacon`. Reading starts nothing, and the server and the hydrating render read state as it stands before any session.
- Requires `@priemskiyyy/beacon` 0.1 and React 19.2.
