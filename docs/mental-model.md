---
description: "The vocabulary of Beacon: subjects, routes, decisions, running facts, evidence, references minted by the ledger, and the statuses a command settles as."
---

# The mental model

Beacon compares three things and never mixes them up: what is running, what an authority wants, and what a provider has prepared. Everything else follows from keeping those apart.

```text
 an authority                 Beacon                                      your application
 (manifest, store,
  provider)

     read / check                                         +-------------+
   ---------------->  document + evidence  --- select --> | observation | --> offer ---+
                                                  ^       +-------------+             |
                                                  |                                   |
 local readers                                    |                                   v
 (the build, a native module)                     |                  route.reload({ offer })
   ---------------->  running facts --------------+                                   |
                                                                                      v
                            reserve -> settle -> revalidate -> dispatch ---------> outcome
                            (your participants, then the provider)                 (a status)
```

## Subjects

A subject is a kind of code that can be executing. They update independently, so each has its own running fact.

| Subject  | What it is                       |
| -------- | -------------------------------- |
| `native` | the installed binary             |
| `bundle` | the JavaScript bundle            |
| `web`    | the web document                 |
| `worker` | the service worker that controls |

## Routes

`new Beacon({ routes })` holds named routes. A route is the unit you check, read and command. There are two kinds.

- A **feed route** takes offers from a release source and commands from an update mechanism. Make one with `targetRoute` or `newerRoute`. The source says what the authority wants, `select` compares it with what runs, and the mechanism carries the commands.
- A **driver route** belongs to a provider that owns both the question and the answer: Expo Updates, Google Play, a service worker. Adapters return one, and it goes into `routes` as it is.

Each route compares against one subject: a feed route against the subject its mechanism names (`browserReload()` replaces the document, so it is `web`, and `appStoreHandoff` opens the store for the binary, so it is `native`), and a driver route against the subject its provider replaces. A route's methods come from its commands, so `browserReload()` gives `route.reload`, and `expoUpdates` gives `route.download` and `route.reload`. See [routes](routes.md).

## Decisions

An authority's statement is one of three decisions. A source produces them, and a route selects from them.

| Decision    | Meaning                                                             | Used by       |
| ----------- | ------------------------------------------------------------------- | ------------- |
| `target`    | this scope should run this release, whatever its order              | `targetRoute` |
| `candidate` | this release exists, and here is its order in a version domain      | `newerRoute`  |
| `none`      | the authority has no release for this scope, and here is its reason | both          |

A missing decision, an empty answer and a failed read are never `none`. `none` is a statement the authority made.

A release has an **identity**: `{ status: "known", authority, domain, value }`, or `{ status: "unknown", reason }`. Two known identities compare only within one authority and one domain. An unknown identity equals nothing, not even another unknown one. `compareIdentities` answers `same`, `different` or `incomparable`, and `incomparable` is never read as a difference. Labels, versions, timestamps and URLs are not identities.

## Running facts

`running` holds one local reader per subject. A reader looks at the build, the native module or the browser, never at a remote manifest, so no remote answer can rewrite what runs. It is given the scope of the read, `{ scope }`, so it can name the authority and the platform of the build without the application repeating them, and after `replaceScope` it is given the new scope. A function with no parameter is a reader too.

A feed route compares an offer with what its subject runs, so `new Beacon` throws for a feed route whose subject has no reader: it could never offer anything. A driver route needs none, and may offer the default reader of its own subject, used only when you pass none: the reader is local like any other, the driver never writes a fact, and the reader you pass always wins. The boot id is optional: every Beacon of one JavaScript runtime shares one that Beacon mints, and `running.boot` is there to choose it.

| State          | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| `unconfigured` | no reader was passed for this subject, and no route needs one |
| `pending`      | a reader exists and has not answered yet                      |
| `known`        | the reader answered: a release and when it was read           |
| `failed`       | the reader threw, rejected or took too long: an error info    |

A subject that is not `known` is never read as an old version. A route compared against it says `inconclusive`.

## Evidence, freshness and revisions

Every accepted observation carries its **evidence**: the `source` that produced it, its `origin` (`network` or `provider`), `receivedAt`, `expiresAt`, `freshness`, `issuer` and `revision`.

- **Freshness is time.** Evidence is `fresh` until `expiresAt` and `expired` after. A failed check never changes it. An `expiresAt` of `null` never expires, which is what a provider's report has: it is what the provider said at the last check.
- **A failed check never erases what was accepted.** The check says `failed` and the last observation stays, aging on its own clock.
- **Revisions are judged before a document is accepted.** An authority may number its decisions, either as `opaque` text or as `ordered` decimal strings within a domain and an epoch. A lower revision is rejected as `REVISION_REGRESSION`. The same revision with different content is `REVISION_CONFLICT`. Another domain or epoch is `REVISION_EPOCH_CHANGED`, never assumed newer. The same revision with the same content is a renewal: it refreshes the evidence and offers nothing new.

Ordered revisions are decimal strings compared digit by digit, so no number size rounds them.

## The state of a route

A route publishes one snapshot in four dimensions that never rewrite each other.

| Dimension     | Values                                                     |
| ------------- | ---------------------------------------------------------- |
| `check`       | `idle`, `checking`, `succeeded` or `failed` with the error |
| `observation` | `unknown`, `none`, `available` or `inconclusive`           |
| `prepared`    | `not-applicable`, `unknown`, `none` or `ready`             |
| `operation`   | `idle`, `running` or `indeterminate`                       |

`beacon.route("web").state.get()` returns it, and it keeps its identity until something meaningful changes. `succeeded` means an authority answered, not that an update exists. `available` is the only observation with an offer. `inconclusive` means the evidence cannot say, and it is never "up to date".

`prepared` is what a provider reports as ready for a later step: a downloaded bundle, an activated worker. It is kept apart from the observation, so a new download never erases an older ready target. A provider that cannot report across a restart starts at `unknown`, never `none`.

Beside the routes, `beacon.running` is the composite of the running facts, and `beacon.support` is what your policy says about them; see [support](support.md).

## References

An offer arrives with a `ref`, and a ready prepared target arrives with its own. They are minted by the core and recognized by identity.

- A command takes the reference it declares: `offer`, `prepared`, an optional offer, or none.
- A reference is good for its route, and only while it is current.
- A copy is refused, a forgery is refused, and so is a reference of another route. The types refuse the ones they can see: an offer reference does not fit where a prepared one is asked for.

A refused reference settles as `stale` with a reason: `foreign`, `replaced`, `expired` or `provider-changed`. Nothing is reserved before that check.

## Command outcomes

Every expected failure is a status, and a command never rejects.

| Status          | Means                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| `accepted`      | the provider took the request, and the receipt names exactly what was accepted    |
| `blocked`       | a participant or a running operation refused it, with the reasons                 |
| `stale`         | the reference is no longer good, with the reason                                  |
| `unsupported`   | this environment cannot do it, with the reason                                    |
| `cancelled`     | the caller or the session stopped it before it took effect, with the stage        |
| `failed`        | it did not take effect, with the error                                            |
| `indeterminate` | it may have taken effect and the outcome was lost, so it is never retried blindly |

`accepted` is a request, never an installation. A reload request, a store handoff and a started flow are receipts that name what was accepted. Only a later boot shows what runs. [Commands](commands.md) covers each status and how to handle all seven.

## What Beacon never claims

- That a check found no update: only `none` says the authority has no release for the scope.
- That an accepted command installed anything.
- That a running fact is what a manifest says.
- That coordination reaches beyond one Beacon in one JavaScript instance. See [limits](limits.md).
