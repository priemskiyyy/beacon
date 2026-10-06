# Architecture

One `Beacon` per application holds named routes. A route is either a feed route, whose offers come from a release source and whose commands come from a mechanism, or a driver route, where a provider owns both.

## Ownership

| Owner                | What it owns                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Beacon`             | the session (`start`, `stop`, `dispose`), the public handles, and the wiring of the parts below                                               |
| `BeaconRuntime`      | the status, the current session and the order of cleanup, through a `ResourceScope`                                                           |
| `RunningRegistry`    | what is running per subject (`native`, `bundle`, `web`, `worker`), from readers the application passes                                        |
| `RouteRegistry`      | every route's published state, the shared feeds and the drivers; a source read once selects for all its routes in one transaction             |
| `FeedRecord`         | one source's accepted document, its evidence, the revision judgement and the expiry timers                                                    |
| `SharedRead`         | one in-flight read per source: joined callers, one trailing read, abort of the transport only when nobody waits, timeouts and session fencing |
| `RouteRecord`        | one route's snapshot: check, observation, prepared and operation, installed only through a transaction                                        |
| `ReferenceLedger`    | the offer and prepared references, minted by the core and recognized by identity                                                              |
| `CommandCoordinator` | one operation per route, one disruptive operation across routes, and the order reserve, settle, revalidate, dispatch                          |
| `DisruptionRegistry` | the participants, their reservations in registration order, and the registry revision                                                         |
| `PolicyRecord`       | the support state, the last valid evaluation beside a failure or a lapse, and the evaluations run only when the document or the facts changed |
| `Journal`            | the intents written before a realm-replacing command, the readiness checkpoints, and the queue that orders every read and write of the record |

Adapters own their provider's mapping and nothing else. The core never branches on an adapter's name.

## Invariants

Each is proven by tests named after the case it protects.

- **Inert until started.** Constructing, reading and subscribing arm no timer, read no clock, call no reader and touch no platform (CORE-01, WEB-12).
- **Snapshots keep their identity** until a meaningful change, and an install that changes nothing notifies nobody (CORE-06).
- **Every store of a change is installed before any listener runs**, so no observer sees a route from one commit and the running facts from another (CORE-07).
- **Listeners are isolated**: one that throws is reported and the others run; a listener removed during a pass is skipped; one added waits for the next pass; a nested pass supersedes the rest of the outer one (CORE-08 to CORE-12).
- **An unknown identity equals nothing**, not even another unknown one, and identities of different authorities or domains are incomparable (CORE-13, VER-01).
- **A missing fact is pending or unknown, never an old version** (CORE-14).
- **A failed check never erases what was accepted.** The observation and its evidence stay, the check says failed, and evidence goes stale by time alone (CORE-02, CORE-03).
- **Revisions are judged before a document is accepted**: a regression, a conflict and another epoch are rejected and the accepted decision stays; a renewal refreshes evidence without a new offer (VER-13 to VER-16).
- **Order is exact**: decimal strings are compared without floating point or `BigInt` (VER-07 to VER-09).
- **A session fences its callbacks.** An answer that arrives after `stop()` changes nothing and is counted, and the stop of an old session cannot end a newer one (LIFE-01, LIFE-02).
- **References are minted by the core.** A copy, a forgery, a reference of another route, a replaced offer and an expired one are each refused with their own reason, before anything is reserved (BIND-03).
- **One operation per route.** An identical call joins the running one; a different call is blocked, never queued. One disruptive command runs across routes at a time (SAFE-08, SAFE-09).
- **Reserve before settle.** Every relevant participant closes its admission synchronously, in registration order, before any of them starts settling, and a refusal releases the earlier reservations in reverse (SAFE-02, SAFE-03).
- **Revalidate before dispatch.** References, the participant registry and the caller's signal are checked again immediately before the provider is asked, and a change blocks the command instead of being ignored (SAFE-06).
- **Accepted is not installed.** A receipt names what was accepted: a reload request, a store handoff, a started flow. Nothing changes what is running except a later boot (WEB-01).
- **An abort ends a wait.** Before the dispatch it cancels and releases; after it, the command is indeterminate (SAFE-10, SAFE-11).
- **A command that may have taken effect is never retried blindly.** The route stays unresolved, and refuses the next command, until the application acknowledges it (WEB-03).
- **A scope owns what it taught.** `replaceScope` fences the old reads, forgets the documents, observations, prepared targets, support and journal intents of the scope that ended, keeps the running facts, and is blocked while an operation is running or unresolved (LIFE-08, LIFE-09).
- **One session holds a native manager.** A driver that names the manager it needs with `exclusive` cannot be opened by a second session while the first holds it, and the second route says `DRIVER_FAILED` (LIFE-11).
- **Drivers cannot write running facts**, and a driver's emitter is fenced by its session.

## Layout

Each package keeps `types/` (one type per file, internals in `types/internal/`), `utils/` (one export per file, internals in `utils/internal/`) and `utils/constants/`. Package roots export the supported API explicitly and no other file re-exports. A test sits beside its source, and a `*.contracts.ts` file is typechecked, never run: each `@ts-expect-error` is a rule the types enforce so the code does not check it again at runtime.
