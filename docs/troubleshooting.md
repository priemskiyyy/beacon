---
description: "Find the cause of a Beacon symptom from its BeaconError code or its state: failed checks, nothing on offer, stale and blocked commands, provider routes, types and hydration."
---

# Troubleshooting

Beacon says what went wrong in one of two places. Misconfiguration and use after disposal throw a `BeaconError`. Everything else is a status, and its error is a `{ code, message }` in state or in an outcome.

```ts
import { BeaconError } from "@priemskiyyy/beacon";

try {
  // @ts-expect-error A route that was never defined does not compile, so this comes from untyped code.
  beacon.route("missing");
} catch (error) {
  if (error instanceof BeaconError && error.code === "INVALID_CONFIGURATION") {
    console.error(error.message);
  }
}
```

The thrown error keeps whatever a source, driver or listener threw as `cause`. Published state keeps the code and the message alone, so a snapshot never holds a provider payload, a URL or a credential.

When the code and the message are not enough, subscribe before you start and read what was thrown:

```ts
beacon.diagnostics.events.subscribe((event) => {
  console.warn(event.type, event.reason, event.cause);
});
```

The events that report a failure carry the raw value in `cause`: `read-failed`, `running-failed`, `route-failed`, `policy-failed`, `journal-failed` and `command-settled` when the command failed. It is `null` when nothing was thrown, such as a timeout. A cause can hold a URL or a provider payload, so a listener that forwards events to telemetry must drop it.

## The codes

| Code                     | You see it as                                                                                 | Usual cause                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_CONFIGURATION`  | a throw                                                                                       | an unknown route name from untyped code, a feed route whose subject has no reader, a timeout or journal option that is not a positive whole number, a hook outside its provider, a bad App Store id or storefront |
| `DISPOSED`               | a throw from `start()`, `replaceScope()` or `reportReady()`; `failed` in a check or a command | the Beacon was disposed. Create a new one                                                                                                                                                                         |
| `NOT_STARTED`            | `failed` in a check or a command                                                              | no open session. Call `start()`, or mount a `BeaconProvider` that is not given `start={false}`                                                                                                                    |
| `DRIVER_FAILED`          | a failed check, a failed command, or a route that stays closed                                | the provider threw while it was checked or answered what is no observation; the provider is not open, because it threw when it opened or another Beacon session holds its native module                           |
| `INVALID_VERSION`        | a throw from `parse`; a failed check                                                          | a version broke the grammar of its strategy, such as `v2.4.0` under `semver()`                                                                                                                                    |
| `SELECTION_FAILED`       | a failed check                                                                                | the select function of the route threw, or a version strategy threw something that is not a `BeaconError`                                                                                                         |
| `IDENTITY_CONFLICT`      | a failed check                                                                                | a candidate has the identity of what runs but a different order                                                                                                                                                   |
| `SOURCE_FAILED`          | a failed check                                                                                | your source or client threw, rejected, or refused a status                                                                                                                                                        |
| `SOURCE_TIMEOUT`         | a failed check                                                                                | a source or a provider took longer than `timeouts.check`                                                                                                                                                          |
| `INVALID_DOCUMENT`       | a failed check                                                                                | a document broke the contract: its revision, scope or times, or the standard manifest's schema                                                                                                                    |
| `ABORTED`                | a failed check                                                                                | every caller stopped waiting, or the session ended during the read                                                                                                                                                |
| `RUNNING_READ_FAILED`    | `failed` in a running fact                                                                    | a running reader threw, rejected or took longer than `timeouts.running`                                                                                                                                           |
| `REVISION_REGRESSION`    | a failed check                                                                                | a decision revision went backwards, or an unversioned decision followed a versioned one                                                                                                                           |
| `REVISION_CONFLICT`      | a failed check                                                                                | the same decision revision arrived with different content                                                                                                                                                         |
| `REVISION_EPOCH_CHANGED` | a failed check                                                                                | a revision came from another domain or epoch, which is never assumed newer                                                                                                                                        |
| `COMMAND_FAILED`         | `failed` in an outcome                                                                        | a provider command threw, or the provider reported a failure. It did not take effect                                                                                                                              |
| `POLICY_FAILED`          | `error` in support state; `support` failed in a check                                         | the policy threw while it was projected or evaluated, or named a route the Beacon does not have                                                                                                                   |
| `JOURNAL_FAILED`         | `failed` in an outcome                                                                        | a required journal could not persist an intent, so the provider was never asked                                                                                                                                   |

## Checks

### A check fails with NOT_STARTED

Nothing asks an authority until a session is open. Call `beacon.start()`, or mount `BeaconProvider`, which starts the session unless you gave it `start={false}`. In React, the provider starts the session in a layout effect, so a check in a component's `useEffect` finds it running, and a check in a child's `useLayoutEffect` does not: check once `useBeaconStatus` says `running` there. See [getting started](getting-started.md#_4-check).

### The check succeeded and nothing is offered

`succeeded` means an authority answered, not that an update exists. Read the observation:

- `none` with `same-identity`: the offered release is the one running. That is a correct answer.
- `none` with `no-decision`: the authority has no release for this scope. `detail` is its own reason.
- `none` with `older-than-current` or `equal-order`: a `newerRoute` never offers those. Use a `targetRoute` if a different release should replace it.
- `none` with `not-admitted`: a prerelease under `semver()`. Pass `{ prereleases: "include" }` if you want it.
- `inconclusive`: the evidence cannot say. Read the reason, below.

The full list is in [routes](routes.md#the-observation).

### The route says inconclusive

Read `observation.detail` first: it names the running reader's reason, or the authority or domain that differs with both words.

| Reason                     | Cause                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `missing-current-identity` | the running fact is not `known` (`detail` is `running-not-known`: check `beacon.running.get()` for `failed` or `pending`), or its identity is unknown (`detail` is the reader's reason, such as `build-id-not-injected`) |
| `incomparable-identity`    | the running release and the offered one have a different `authority` or `domain`, which `detail` names with both words, or the offered identity is unknown. Make the reader and the manifest use the same                |
| `missing-current-order`    | the `current` function of a `newerRoute` answered `null`                                                                                                                                                                 |
| `incomparable-order`       | the strategy answered `incomparable` for the two values                                                                                                                                                                  |

### The Beacon throws that a route has no reader

A feed route compares what its source offers with what its mechanism's subject is running, so it needs a reader for that subject, and without one it could never offer anything. `new Beacon` throws `INVALID_CONFIGURATION` and names the route and the subject: `Route "web" compares against the "web" subject, but running.web has no reader.` Pass the reader under that subject in `running`, such as `web: webBuild({ id })`, or a function of your own. A driver route needs none, and two driver routes that each supply a reader for one subject need you to pass the one you want.

### A running fact is failed or pending

`pending` means the reader has not answered. `failed` carries `RUNNING_READ_FAILED`: the reader threw, rejected, or took longer than `timeouts.running`. A check waits only for the subjects its route depends on, and a subject with no reader stays `unconfigured`.

### Support stays unknown

Read `beacon.support.get().reason`. `no-policy` means the Beacon has no `policy`. `not-checked` means no check has run, so call `beacon.check()`. `read-failed` means the last read of the policy's source failed and nothing is in force: `error` carries its code and message, such as `SOURCE_FAILED` for a key the source does not have, and `evaluation` holds the last valid one if there was one. `evaluation-failed` means the policy threw or named a route the Beacon does not have. `expired` means the accepted policy lapsed and no read has failed since.

### The source fails with INVALID_DOCUMENT

The message names the rule. For the standard manifest, the usual ones are a scope that differs from the Beacon's in `application`, `environment`, `platform` or `distribution`, a manifest that has expired or lives longer than the lifetime limit, a route the manifest lacks, a decision of the wrong kind for the declared route, and a body that is not JSON, such as a login page. See [HTTP](http.md#what-is-accepted).

### The source fails with SOURCE_FAILED

Your client threw or rejected, or the standard manifest reader refused a status: `204`, `401`, `403`, `404`, `429`, a server error or a redirect. Beacon never reads any of those as "no release". A `not-modified` answer when the source holds no document to renew is also `SOURCE_FAILED`, for example on the first read after the scope changed.

### REVISION_REGRESSION, REVISION_CONFLICT and REVISION_EPOCH_CHANGED

Beacon judges a decision's revision before it accepts the document, and the accepted decision stays.

- `REVISION_REGRESSION`: an older copy was served late, often by a cache or a CDN. Fix the cache. Nothing in Beacon lowers the mark.
- `REVISION_CONFLICT`: the same revision with different content. A deployment reused a revision.
- `REVISION_EPOCH_CHANGED`: the domain or the epoch changed. Beacon does not assume the new one is newer. The mark lives in memory, so a new page load or `replaceScope` starts from nothing.

### SOURCE_TIMEOUT

The source or provider took longer than `timeouts.check`, 10,000 milliseconds by default. The last observation stays. Raise `timeouts.check` if the authority is slow, and fix a source that does not honor its `signal`.

## Commands

### A command settles as stale

The reference is no longer good. The reason says which way.

| Reason             | Cause                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `foreign`          | Beacon did not mint the reference: a copy, a forgery, another route's, or another Beacon's. Pass the `ref` object as you read it |
| `replaced`         | it is no longer the route's current offer or prepared target, because a newer check replaced it                                  |
| `expired`          | the evidence behind the offer lapsed. Check again                                                                                |
| `provider-changed` | the provider no longer has that target                                                                                           |

### A command is blocked

| Code                      | Cause                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `operation-in-progress`   | another command holds this route, or another route holds the one disruptive slot                                                     |
| `operation-indeterminate` | the last command may have taken effect and was not confirmed. Call `route.acknowledge()` when you decide to continue in this runtime |
| `safety-changed`          | a participant registered or left while the command was settling. Call again                                                          |
| `settlement-timeout`      | a participant did not settle within `timeouts.settlement`                                                                            |
| `settlement-failed`       | a participant threw or rejected while settling, or the host clock could not arm its deadline                                         |
| `reservation-failed`      | a participant threw when asked to reserve                                                                                            |

Any other code is a participant's own. The reason names it.

After an accepted reload, the next command is blocked with `operation-indeterminate` until you acknowledge. In practice the page is gone by then. It is the price of not resuming as if nothing was requested.

### A command settles as failed

`COMMAND_FAILED` is a provider command that threw. `DRIVER_FAILED` says the provider is not open: the mechanism or driver threw when the session started, or another Beacon session holds its native module. `NOT_STARTED` and `DISPOSED` say there is no session. `JOURNAL_FAILED` says the required journal could not write.

### The command was accepted and nothing changed

An accepted command is a request. `reload-requested`, `activation-requested`, `completion-requested` and `store-handoff-requested` name what was accepted. The running build changes only at a later boot. For a service worker, the worker must handle the `SKIP_WAITING` message, or nothing happens. With the [journal](journal.md) on, the next boot says what came of it.

### The command is unsupported

The reason is the adapter's: `no-document` (the browser adapter has no window), `no-registration` (no service worker is registered), `updates-disabled` (Expo Updates is off, as in development or Expo Go), `flow-not-allowed` (Play does not allow that flow now).

## Provider routes

### Expo says unknown

The observation is `unknown` with `unsupported-environment` when `expo-updates` is disabled, or when a development client, which reports `isEnabled` and then refuses every call, or a debug build refuses the call. Expo Go runs no updates. It is never `none`. Run a release build that has an update URL and a runtime version. See [where updates cannot run](expo.md#where-updates-cannot-run).

### Expo says none and an update was published

The server answers with the most recent update for the runtime version and the channel of the build. An update published for another runtime version or another channel is not offered, and the answer is `none` with the detail `noUpdateAvailableOnServer`. Compare `raw.runtimeVersion` and `raw.channel` of the running bundle with what you published. See [runtime versions and channels](expo.md#runtime-versions-and-channels).

### Play says unknown

`unknown` is what Play answers when it cannot say, such as no Play services or an ineligible install. `none` with `not-available` is not proof that no release exists.

### The service worker route never offers

- `unknown` with `unsupported-environment`: the page has no service workers, as in a server render or an insecure context such as plain http. Serve the page over https, or pass the `container` you have.
- `none` with `no-registration`: no worker is registered for this page. Register one, or pass `registration` as a function that finds it.
- `none` with `first-install` or `installing`: the first worker is not an update.
- An offer needs a waiting worker next to an active one.

### The installed binary is unknown

A `native` running fact that says `unknown` names its reason. `another-application` means the native module answered for a different application id than the application of the scope (or the `authority` you gave the reader), and that is what Expo Go does, since it is its own app: none of its version numbers is kept. `build-not-read` means the module gave no build number, or `react-native-device-info` answered its text `unknown`. `application-not-read` means it gave no application id. `unsupported-platform` means the scope's `platform` is neither `ios` nor `android`, such as a web build of the same app, and the module was not asked. No store or Play route compares against a binary it cannot name. See [what the binary is](react-native.md#what-the-binary-is).

### The web build is unknown

A `web` running fact that says `unknown` with the reason `build-id-not-injected` means the id that `webBuild` reads was missing, empty or the text `undefined` when the code was built: the define or the environment variable, such as `VITE_BUILD_ID` or `NEXT_PUBLIC_BUILD_ID`, was not set where the build ran. The journal then says `inconclusive` and the route compares nothing. See [what the running fact must say](browser.md#what-the-running-fact-must-say).

### DRIVER_FAILED when opening

The message says which it is, for a check and for a command that finds the provider closed alike. "The provider is not open: its native module is held by another Beacon session" means a driver that names an exclusive native manager was opened by a second session. "The provider is not open: it threw while it opened" means its own `open` threw, and the error is the `cause` of the `route-failed` event that `start()` records. If two Beacons exist, for example after a hot reload created a second one, stop the first with `stop()` or `dispose()`. With Fast Refresh, keep the Beacon in a module of its own and start it through the provider, which ends the old session before the new one opens: see [the provider](react-native.md#the-provider).

## Types

| Compiler says                                                                                   | Cause                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Property 'reload' does not exist on type 'RouteHandle<...>'`                                   | the route's mechanism or driver does not declare that command. See the command tables in [commands](commands.md#what-each-command-declares) |
| `Argument of type '"x"' is not assignable to parameter of type '"web"'`                         | a route name that was never defined                                                                                                         |
| `Type 'OfferReference<"a">' is not assignable to type 'OfferReference<"b">'`                    | a reference of another route                                                                                                                |
| `Object literal may only specify known properties, and 'prepared' does not exist`               | the command needs an offer, not a prepared reference                                                                                        |
| `Argument of type '"web"' is not assignable to parameter of type '"Register your Beacon: ..."'` | `Register` is missing, or its module is not part of the program. Merge your Beacon into it as [React](react.md#register-your-beacon) shows  |
| `Property 'route' does not exist on type 'UnregisteredBeacon'`                                  | the same cause: a Beacon without a `Register` has no route to read by name                                                                  |
| `Type ... is not assignable to type 'never'` on a command name                                  | the name is one a route handle already has: `state`, `native`, `capabilities`, `check` or `acknowledge`                                     |
| `exactOptionalPropertyTypes` errors on `validator` or `signal`                                  | leave the property out instead of passing `undefined`                                                                                       |

## React

### A hook throws INVALID_CONFIGURATION

There is no `BeaconProvider` above the component. The message names the hook that was called and the package that has the provider, such as `useRoute needs a BeaconProvider (from @priemskiyyy/beacon-react) above it.` A route name that is not one of the Beacon's throws the same code and lists the routes it has.

### The banner never appears

Reading a route never starts a session or a check. Confirm the provider was not given `start={false}`, that something calls `beacon.check()`, and that the check `succeeded`. Read `useRoute("web", (snapshot) => snapshot.check)` to see it.

### A hydration mismatch

The server and the hydrating render read the state as it stood before any session. If you read `beacon.route("web").state.get()` outside a hook during render, you read the live state, and it may differ from the server's. Use the hooks, and start the Beacon through the provider. See [React](react.md#server-rendering-and-hydration).

## React Native

### crypto.randomUUID is not a function

Hermes has no `crypto`. A Beacon mints its boot id by itself with `createBootId()`, which falls back to `Math.random()`, so leave `running.boot` out: [the boot id](react-native.md#the-boot-id).

### An async function answers undefined

On Hermes V1 an async arrow function whose parameter is not a plain name, such as `async ({ scope }) => {}`, resolves `undefined`, so a `fetch` or a `read` you wrote that way makes a check fail with an error about reading a property of `undefined`. Expo's preset and the preset of a bare app repair it; a custom Babel setup has to lower `async` or repair the function. Give the parameter a plain name and destructure inside until it does. See [the engine and the toolchain](react-native.md#the-engine-and-the-toolchain).

### A class is not supported

Classic Hermes compiles no class and no `async`. The preset has to transform `@priemskiyyy/*` like your own code.

## Journal

- `journal: "degraded"`: a read, a write or a remove of the storage failed or did not answer within `timeouts.journal`. With `mode: "required"` the next command that replaces the realm settles as `failed` with `JOURNAL_FAILED`.
- `latest.outcome` is `inconclusive`: an identity is unknown or of another domain. Use the same authority and domain for what runs and what the intent aimed at. `webBuild`, `expoApplication` and `deviceInfo` name what runs in the words the adapters and the standard manifest use.
- `latest.outcome` stays `same-boot`: no new boot has been observed. A page restored from the back-forward cache is the same boot. See [browser](browser.md#a-page-restored-from-the-back-forward-cache).
- A corrupt or future record is ignored, and the diagnostics say `journal-ignored`.

## Diagnostics

`beacon.diagnostics.events.subscribe` shows what Beacon does as it does it, without a URL, a manifest or a payload, except the `cause` of a failure: `read-started`, `read-failed`, `command-admitted`, `command-settled`, `route-failed` and the rest. `late-callback` counts an answer that came after its session ended, which is normal after a `stop()`, or a journal storage answer that came after its deadline. See [sessions](sessions.md#diagnostics).
