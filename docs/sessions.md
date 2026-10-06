---
description: "Construct, start, stop and dispose a Beacon, what a session owns, what each status does to checks and commands, and how to read diagnostics."
---

# Sessions

A Beacon has a lifetime with four statuses. Almost everything it does happens inside a session, and nothing starts until you open one.

```text
idle --start()--> running --stop()--> stopped --start()--> running ...
                     |                   |
                     +---- dispose() ----+----> disposed (for good)
```

`beacon.status.get()` says which: `{ state: "idle" }`, `{ state: "running", session }` with the session number, `{ state: "stopped" }` or `{ state: "disposed" }`. It says nothing about any release.

## Inert until started

Constructing, reading and subscribing start nothing. No timer is armed, no clock is read, no reader is called and no platform is touched.

| You do                                | What happens                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `new Beacon(options)`                 | options are read once; nothing else                                                  |
| `beacon.route("web")`                 | the stable handle; passive                                                           |
| `state.get()`, `state.subscribe(...)` | reads the snapshot; a subscription never calls back at once and never starts a check |
| `state.getInitial()`                  | the snapshot before anything happened, which is what a server renders                |
| `beacon.check()` before `start()`     | settles as `failed` with `NOT_STARTED`; nothing is asked                             |

Every observable has `get`, `getInitial` and `subscribe`. `get` keeps its identity until something meaningful changes, and a listener is told after every store of the change is installed. A listener that throws is reported to the host's error handling, outside the current delivery, and the others still run.

## Start

```ts
const stop = beacon.start();
```

`start()` opens the observation session. It answers a stop function. Starting again while a session is open answers the same stop and opens nothing more. The stop of an old session never ends a newer one.

What a new session does:

1. Publishes `running` with the session number.
2. Reads every configured running fact, once.
3. Opens each route: a mechanism's `open()`, or a driver's `open()` followed by its `reconcile`, which reads the provider's current local state again.
4. Arms the expiry of a document held from before, or expires it if its time passed.
5. If the journal is on, reads its record and reconciles it with what runs. See [journal](journal.md).

It fetches nothing. Checks are yours to make. A route whose mechanism or driver fails to open reports `route-failed` in the diagnostics and leaves the other routes usable. A driver that names an `exclusive` native manager fails to open when another session holds it, and its route says `DRIVER_FAILED`.

## Stop

```ts
beacon.stop();
```

Callbacks fall silent and owned timers stop. Every `route.native` becomes `null`. It does not undo native side effects: a download that was started keeps going. The observations, the evidence and the last snapshots stay readable, and evidence does not expire while no session runs. When a session opens again, whatever passed expires at once.

An answer that arrives after `stop()` changes nothing and is counted as a late callback. A check that was under way settles as `superseded`.

While stopped, a command settles as `failed` with `NOT_STARTED`, and it asks no provider. A stopped Beacon can start again. Every start is a new session with a new number, and it reads the running facts again.

## Dispose

```ts
beacon.dispose();
```

Ends the Beacon for good. The session stops, reservations are released, and the last snapshots stay readable and stable. It is idempotent. Afterwards:

| Call                         | Result                                |
| ---------------------------- | ------------------------------------- |
| `start()`, `replaceScope()`  | throw a `BeaconError` with `DISPOSED` |
| `check()`, a command         | settle as `failed` with `DISPOSED`    |
| `route(name)`, `state.get()` | work, and read the final snapshot     |

Dispose only when the application ends. A provider operation that continues after disposal leaves its outcome unknown, never cancelled.

## What throws

Beacon never throws into the host from a callback. Only misconfiguration and use after disposal throw, and always a `BeaconError` with a code to branch on.

| Code                    | When                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `INVALID_CONFIGURATION` | a route name that was never defined, an unusable timeout or journal option, a hook outside its provider |
| `DISPOSED`              | `start()` or `replaceScope()` after `dispose()`                                                         |

Everything else is a status: an outcome, a check that `failed`, an error in state.

## The framework providers

`<BeaconProvider beacon={beacon} start>` calls `beacon.start()` when it mounts, before any child's own mount effect runs, and returns the stop as the cleanup, so it holds the session while mounted and a check in a child's mount effect finds it running. It never disposes the Beacon and checks nothing. Under React's Strict Mode the effect runs, cleans up and runs again, which leaves one session open and no check or command made. The Vue, Solid and Svelte providers do the same in their own lifecycle. See [React](react.md), [Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md).

## Timeouts

`timeouts` bounds three things, each 10,000 milliseconds by default.

| Option       | Bounds                                                                               |
| ------------ | ------------------------------------------------------------------------------------ |
| `running`    | how long a running reader may take before its fact is `failed`                       |
| `check`      | how long a source or a provider may take before the read fails with `SOURCE_TIMEOUT` |
| `settlement` | how long a participant may take to settle before a command                           |

A value that is not a positive whole number of milliseconds throws `INVALID_CONFIGURATION` when the Beacon is made.

## Diagnostics

`beacon.diagnostics` is a passive view for logs and devtools. Observing it starts nothing.

```ts
const { status, session, counters } = beacon.diagnostics.get();

console.info(status, session, counters.lateCallbacks);

const stop = beacon.diagnostics.events.subscribe((event) => {
  if (event.type === "late-callback") {
    console.debug(event.route, event.reason);
  }
});

stop();
```

The snapshot has the status, the number of the open session or `null`, and three counters kept whether or not anyone listens: `lateCallbacks`, `listenerErrors` and `cleanupErrors`.

Events never replay, and one is built only while someone listens. An event has a `type`, a `timestamp` on the Beacon clock, and the `session`, `route`, `command`, `attempt`, `operation` and `reason` that apply, each `null` otherwise. It names things by number and name and a short reason code, never a URL, a manifest, a release note, a credential or a provider payload.

| Group     | Types                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------- |
| session   | `session-started`, `session-stopped`, `disposed`                                                    |
| running   | `running-read`, `running-failed`                                                                    |
| checks    | `check-requested`, `read-started`, `read-accepted`, `read-renewed`, `read-failed`, `read-abandoned` |
| failures  | `route-failed`, `policy-failed`, `journal-failed`, `journal-ignored`                                |
| journal   | `journal-read`, `ready-reported`                                                                    |
| commands  | `command-admitted`, `command-settled`                                                               |
| contained | `late-callback`, `listener-error`, `cleanup-error`                                                  |

Event names describe observed facts. An accepted store handoff is never called an installation.
