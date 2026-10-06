---
description: "Declare routes with targetRoute, newerRoute and createReleaseDriver, read the observation and check states, and learn why a route offers nothing."
---

# Routes

A route is a named entry of `routes`. It compares what an authority wants with what runs, and it carries the commands that act on the difference. `beacon.route("web")` returns its handle. A name that was never defined does not compile, and throws `INVALID_CONFIGURATION` when it arrives from untyped code.

| Member                      | What it is                                                                        |
| --------------------------- | --------------------------------------------------------------------------------- |
| `state`                     | the snapshot: `check`, `observation`, `prepared` and `operation`                  |
| `native`                    | the provider handle of the open session, or `null` while none is open             |
| `capabilities`              | what each command declares, as constants                                          |
| `check(options)`            | asks this route's authority                                                       |
| `acknowledge()`             | ends an operation a command left unresolved                                       |
| one method for each command | `reload`, `activate`, `download`, `update`, `restart` or `openStore`, as declared |

Acquiring a handle or observing it starts nothing. Calling `native` directly bypasses Beacon's admission and journal, so treat it as an escape hatch.

## Sources

A source reads one release authority. Make one with `createReleaseSource({ name, read })`, and have `read` answer a document your client has already validated.

```ts
// src/deployments.ts
import { createReleaseSource } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseScope,
  TargetDecision,
} from "@priemskiyyy/beacon";

type Deployment = { web: TargetDecision | NoneDecision };

declare const api: {
  getDeployment(request: {
    scope: ReleaseScope;
    signal: AbortSignal;
  }): Promise<Deployment>;
};

export const deployments = createReleaseSource<Deployment>({
  name: "internal-release-api",
  read: async ({ scope, signal }) => ({
    document: await api.getDeployment({ scope, signal }),
  }),
});
```

`read` receives the scope, a signal that aborts when nobody waits for the answer, and the attempt number. It answers a `SourceRead`, or it rejects. A source that cannot answer rejects, because no answer ever means "no release".

Besides `document`, a read may carry what Beacon needs to judge it.

| Field       | Use                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------- |
| `revision`  | how the authority numbers its decisions, so an older copy is rejected                        |
| `digest`    | a fingerprint of the decision without its renewable times, to tell a renewal from a conflict |
| `issuer`    | who vouches for it                                                                           |
| `expiresAt` | epoch milliseconds when the answer stops holding                                             |

An answer without `expiresAt` never goes stale by time. Give it one whenever the backend can.

### One source, many views

`source.select(project)` returns a typed view of the document without a second read. Keep one source per authority and select a view for each route and for the support policy. Views of one source share one read and one accepted document, so a route and a policy never see two different revisions.

## targetRoute

`targetRoute` offers the release an authority names when it is a different, comparable release from the one running. It is for a deployment, which can roll back to an older build, so a rollback is an ordinary offer.

```ts
import { targetRoute } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";

import { deployments } from "src/deployments";

export const web = targetRoute({
  subject: "web",
  source: deployments.select((document) => document.web),
  mechanism: browserReload(),
});
```

Its source can only produce `target` and `none` decisions. The selection is pure:

1. A `none` decision is `none` with reason `no-decision`, and the authority's own code as `detail`.
2. A release whose `compatibility` says `incompatible` is `none` with reason `incompatible`.
3. A running fact that is not known, or has an unknown identity, is `inconclusive` with `missing-current-identity`.
4. Identities of different authorities or domains are `inconclusive` with `incomparable-identity`.
5. The same identity is `none` with `same-identity`.
6. A different identity is an offer, whatever its order.

## newerRoute

`newerRoute` offers a candidate only when a version strategy admits it and it orders newer than what runs. It is for a store or a release feed, where an older version is never an update.

```ts
import { createReleaseSource, newerRoute } from "@priemskiyyy/beacon";
import type { CandidateDecision, NoneDecision } from "@priemskiyyy/beacon";
import { appStoreHandoff } from "@priemskiyyy/beacon-app-store";
import { semver } from "@priemskiyyy/beacon/versions";
import { Linking } from "react-native";

type Catalog = { latest: CandidateDecision<string> | NoneDecision };

const catalog = createReleaseSource<Catalog>({
  name: "release-catalog",
  read: async () => ({
    document: {
      latest: {
        kind: "candidate",
        release: {
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "marketing-version",
            value: "2.5.0",
          },
          order: "2.5.0",
          label: "2.5.0",
        },
      },
    },
  }),
});

export const binary = newerRoute({
  subject: "native",
  source: catalog.select((document) => document.latest),
  version: semver(),
  current: (release) => {
    const name = release?.raw.versionName;

    if (typeof name !== "string") {
      return null;
    }

    return name;
  },
  mechanism: appStoreHandoff({ appId: "284882215", linking: Linking }),
});
```

The candidate's `order`, the strategy's input and the value `current` returns share one type, so a mismatch does not compile. `current` reads the order of what runs from its release, and answers `null` when it cannot say. The selection runs in this order:

1. `none` and `incompatible` are as for a target route.
2. A `current` of `null` is `inconclusive` with `missing-current-order`.
3. A candidate the strategy does not admit, such as a prerelease under `semver()`, is `none` with `not-admitted`.
4. Two values the strategy cannot order are `inconclusive` with `incomparable-order`.
5. An equal order is `none`: `equal-order`, or `equal-order-different-identity` when the release is another one. Only a target route offers that.
6. A candidate with the identity of what runs but a different order is a contradiction. The check fails with `IDENTITY_CONFLICT`.
7. An older order is `none` with `older-than-current`, and a newer one is an offer.

A strategy that throws fails the check with `SELECTION_FAILED`, or keeps its own `INVALID_VERSION`. Strategies are `semver`, `integer` and `custom` from `@priemskiyyy/beacon/versions`; see [support](support.md#version-strategies).

## Driver routes

`createReleaseDriver` declares a route a provider owns, such as Expo Updates or Google Play. There the provider answers the check, reports what it has prepared and carries the commands. You rarely call it yourself: an adapter returns the route and you put it in `routes`.

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";

declare const bridge: PlayBridge;

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: "google-play",
  },
  running: { boot: { id: "boot-1" } },
  routes: { binary: googlePlay({ bridge }) },
});
```

[Custom adapters](custom-adapters.md) shows how to write one.

## The observation

`route.state.get().observation` is what the route has accepted. A failed check leaves it in place and ages it.

```ts
const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  console.info("On offer:", observation.offer.release.label);
} else if (observation.status === "none") {
  console.info("Nothing on offer:", observation.reason, observation.detail);
} else if (observation.status === "inconclusive") {
  console.info("Cannot tell:", observation.reason);
} else {
  console.info("Not known yet:", observation.reason);
}
```

| Status         | Carries                                     | Means                                                             |
| -------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `unknown`      | `reason`                                    | nothing accepted in this session, or the provider cannot run here |
| `none`         | `evidence`, `reason`, `detail`, `candidate` | the authority has nothing on offer for this scope                 |
| `available`    | `evidence`, `offer`                         | a release is on offer, with a reference to act on                 |
| `inconclusive` | `evidence`, `reason`, `candidate`           | the evidence cannot say, which is never "up to date"              |

The reasons are closed sets.

| Status         | Reason                           | Means                                                       |
| -------------- | -------------------------------- | ----------------------------------------------------------- |
| `unknown`      | `not-checked`                    | nothing has been accepted yet in this session               |
| `unknown`      | `unsupported-environment`        | the provider cannot run here, such as a development client  |
| `none`         | `no-decision`                    | the authority said it has no release for this scope         |
| `none`         | `same-identity`                  | the offered release is the one running                      |
| `none`         | `equal-order`                    | the candidate orders equal to what runs                     |
| `none`         | `equal-order-different-identity` | equal order, another release: only a target route offers it |
| `none`         | `older-than-current`             | the candidate orders below what runs                        |
| `none`         | `not-admitted`                   | the strategy does not admit it, such as a prerelease        |
| `none`         | `incompatible`                   | the release cannot run where it would be installed          |
| `inconclusive` | `missing-current-identity`       | what runs has no known identity                             |
| `inconclusive` | `missing-current-order`          | what runs has no order to compare                           |
| `inconclusive` | `incomparable-identity`          | different authorities or domains                            |
| `inconclusive` | `incomparable-order`             | the strategy could not order the two values                 |

Running facts change what is on offer. When a reader answers, every route selects again from the documents it holds, in one commit, so no listener sees a route from one commit and the running facts from another.

## Checking

`beacon.check()` asks every route's authority and the support policy's, sharing one read per source. `route.check()` asks one route. Neither rejects.

```ts
const report = await beacon.check({ reason: "manual" });

if (report.routes.web.status === "failed") {
  console.warn(report.routes.web.error.code);
}

if (report.support?.status === "failed") {
  console.warn("The support policy could not be read.");
}
```

The report keeps each route and the policy apart, so a failing policy never hides a successful route. There is no "all up to date" boolean: read each route's observation.

| Outcome      | Means                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| `succeeded`  | an authority answered and the answer was accepted, not that an update exists |
| `failed`     | the read failed, with the error; the last observation stays                  |
| `cancelled`  | your own `signal` ended your wait                                            |
| `superseded` | the session or the scope changed under the read                              |

`CheckOptions` has three fields:

- `reason` is `startup`, `manual`, `foreground`, `reconnect`, `invalidation` or `interval`. It only labels the diagnostics.
- `mode` is `join` by default, which shares a read already under way. `after-current` also asks for at most one trailing read after it, and never restarts the current one.
- `signal` ends only your wait. A read that others still wait for goes on.

A check that finds no open session settles as `failed` with `NOT_STARTED`, or `DISPOSED`. A source or provider that takes longer than `timeouts.check` (10 seconds by default) fails the read with `SOURCE_TIMEOUT`.

### The state of the last check

| `check.state` | Carries                             | Means                                                                  |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `idle`        |                                     | no check yet                                                           |
| `checking`    | `attempt`, `startedAt`              | a read is under way; everyone who joined it shares the attempt number  |
| `succeeded`   | `attempt`, `startedAt`, `settledAt` | an authority answered                                                  |
| `failed`      | the same, and `error`               | the read failed, or the selection failed; the observation is untouched |

A selection can fail after the read was accepted, for example when a strategy throws. Then the check says `failed` while the document stays accepted.

## Check timers

Beacon has no scheduler. Check from your own signals: startup, returning to the foreground, reconnecting, or an interval. See [recipes](recipes.md#check-on-foreground-and-on-an-interval).
