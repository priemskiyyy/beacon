---
description: "Test Beacon without a browser or a device: the mock source and the test clock, adapter fakes, held reads, expiry and timeouts, and the conformance suites."
---

# Testing

Everything Beacon does runs in process against fakes, so your tests do too. No browser, no device and no network is needed. Time is a clock you move, and a read is a promise you settle.

Two subpaths help:

- `@priemskiyyy/beacon/mock` has `createMockSource` and `createTestClock`.
- `@priemskiyyy/beacon/testing` has the conformance suites for adapters. They need `vitest`, an optional peer dependency. See [custom adapters](custom-adapters.md#prove-it).

## The mock source

`createMockSource<TDocument>({ name })` is a scriptable source. Reads are held until the test settles them, or answered at once after `answer`. Nothing settles by itself, so an interleaving is a sequence of calls and never a sleep.

| Member          | Does                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| `source`        | the release source to pass to a route, with `select` like any other                     |
| `answer(read)`  | answers every read from now on with this `SourceRead`, until `hold`                     |
| `hold()`        | holds every read from now on until the test settles it                                  |
| `resolve(read)` | settles the oldest held read with an answer                                             |
| `reject(error)` | settles the oldest held read with a failure                                             |
| `contexts()`    | the context of every read Beacon started, oldest first                                  |
| `stats()`       | `{ reads, held, aborted }`: reads started, reads still held, reads whose signal aborted |

`resolve` and `reject` throw when nothing is held. A read can be settled late, after it was aborted, which a real source may do too.

## The test clock

`createTestClock({ now, monotonic })` is a manual `BeaconClock`. Pass it as `clock` to the Beacon, and Beacon reads no other time source. Do not use `vi.useFakeTimers()` for Beacon.

| Member            | Does                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `advance(ms)`     | moves both clocks forward, running every timer that falls due on the way, at its own time       |
| `skip(ms)`        | moves both clocks forward without running a timer, as a frozen page or a suspended runtime does |
| `runDue()`        | runs the timers that are already due                                                            |
| `setNow(epoch)`   | sets epoch time alone, backwards included, as a clock correction does                           |
| `pendingTimers()` | timers armed and neither run nor cancelled                                                      |

`advance` and `skip` refuse a negative or non-finite number.

## A fixture

One helper builds a Beacon over the mock source, the test clock and a fake window. Every test below uses it.

```ts
// src/testBeacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseIdentity,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
import { browserReload } from "@priemskiyyy/beacon-browser";

export type Deployment = { web: TargetDecision | NoneDecision };

export const identity = (value: string): ReleaseIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value,
});

export const deploy = (value: string): Deployment => ({
  web: {
    kind: "target",
    release: { identity: identity(value), label: `Build ${value}` },
  },
});

export const createTestBeacon = () => {
  const mock = createMockSource<Deployment>({ name: "manifest" });
  const clock = createTestClock({ now: 1_000 });
  const reloads = { count: 0 };

  const target = {
    location: {
      reload: () => {
        reloads.count += 1;
      },
    },
  };

  const beacon = new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "web",
      distribution: "public-web",
    },
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: identity("web-build-a"),
        label: null,
        raw: {},
      }),
    },
    routes: {
      web: targetRoute({
        subject: "web",
        source: mock.source.select((document) => document.web),
        mechanism: browserReload({ target }),
      }),
    },
    clock,
  });

  return { beacon, mock, clock, reloads };
};
```

`browserReload({ target })` takes anything with `location.reload()`, so the reload is a counter and no page is touched.

## A test of the whole flow

```ts
import { expect, test } from "vitest";

import { createTestBeacon, deploy } from "src/testBeacon";

test("a deployed build is offered, and a reload is only requested", async () => {
  const { beacon, mock, reloads } = createTestBeacon();

  mock.answer({ document: deploy("web-build-b") });
  beacon.start();

  const report = await beacon.check({ reason: "manual" });

  expect(report.routes.web.status).toBe("succeeded");

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer.");
  }

  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });

  expect(outcome).toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  expect(reloads.count).toBe(1);

  // The old document may stay alive, so the route waits to be acknowledged.
  expect(beacon.route("web").state.get().operation.state).toBe("indeterminate");
});

test("the running build is not offered to itself", async () => {
  const { beacon, mock } = createTestBeacon();

  mock.answer({ document: deploy("web-build-a") });
  beacon.start();
  await beacon.check();

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "none",
    reason: "same-identity",
  });
});
```

## Held reads

`hold` lets a test decide when a read finishes, so it can put two things in flight at once.

```ts
import { expect, test, vi } from "vitest";

import { createTestBeacon, deploy } from "src/testBeacon";

test("overlapping checks share one read", async () => {
  const { beacon, mock } = createTestBeacon();

  mock.hold();
  beacon.start();

  const first = beacon.check();
  const second = beacon.check();

  await vi.waitFor(() => expect(mock.stats().held).toBe(1));

  mock.resolve({ document: deploy("web-build-b") });

  await Promise.all([first, second]);

  expect(mock.stats().reads).toBe(1);
});

test("a failed read keeps what was accepted", async () => {
  const { beacon, mock } = createTestBeacon();

  mock.answer({ document: deploy("web-build-b") });
  beacon.start();
  await beacon.check();

  mock.hold();

  const pending = beacon.check();

  await vi.waitFor(() => expect(mock.stats().held).toBe(1));

  mock.reject(new Error("offline"));

  const report = await pending;
  const { check, observation } = beacon.route("web").state.get();

  expect(report.routes.web.status).toBe("failed");
  expect(check.state).toBe("failed");
  expect(observation.status).toBe("available");
});
```

A source that rejects fails the read with `SOURCE_FAILED`, with your error as the `cause` on the thrown error. The published state keeps the code and message only.

## Time

Evidence goes stale by the clock alone. Give the answer an `expiresAt` and move the clock.

```ts
import { expect, test, vi } from "vitest";

import { createTestBeacon, deploy } from "src/testBeacon";

test("an offer that lapsed is stale, and the check that would renew it is yours", async () => {
  const { beacon, mock, clock, reloads } = createTestBeacon();

  mock.answer({ document: deploy("web-build-b"), expiresAt: 61_000 });
  beacon.start();
  await beacon.check();

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer.");
  }

  expect(observation.evidence.freshness).toBe("fresh");

  clock.advance(60_000);

  const lapsed = beacon.route("web").state.get().observation;

  if (lapsed.status !== "available") {
    throw new Error("Expected the offer to stay.");
  }

  expect(lapsed.evidence.freshness).toBe("expired");

  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });

  expect(outcome).toEqual({ status: "stale", reason: "expired" });
  expect(reloads.count).toBe(0);
});

test("a source that never answers fails the check at its timeout", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  mock.hold();
  beacon.start();

  const pending = beacon.check();

  await vi.waitFor(() => expect(mock.stats().held).toBe(1));

  clock.advance(10_000);

  const report = await pending;

  expect(report.routes.web).toMatchObject({
    status: "failed",
    error: { code: "SOURCE_TIMEOUT" },
  });
});
```

The timeouts default to 10,000 milliseconds. Set `timeouts` to change them.

## Disruptions

Register a participant and see that nothing is asked of the platform while it blocks.

```ts
import { expect, test } from "vitest";

import { createTestBeacon, deploy } from "src/testBeacon";

test("a draft that cannot be saved blocks the reload, and the platform is never asked", async () => {
  const { beacon, mock, reloads } = createTestBeacon();

  beacon.disruptions.register({
    name: "drafts",
    impacts: ["document-replacement"],
    reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
  });

  mock.answer({ document: deploy("web-build-b") });
  beacon.start();
  await beacon.check();

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer.");
  }

  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });

  expect(outcome).toEqual({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "drafts" } }],
  });
  expect(reloads.count).toBe(0);
});
```

## Faking a provider

An adapter takes the SDK as an argument, typed structurally, so a fake is an object of the same shape. Expo Updates:

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expoUpdates } from "@priemskiyyy/beacon-expo";
import type { UpdatesLike } from "@priemskiyyy/beacon-expo";
import { expect, test } from "vitest";

const createUpdates = () => {
  const calls = { reloads: 0 };

  const updates: UpdatesLike = {
    isEnabled: true,
    updateId: "update-1",
    channel: "production",
    runtimeVersion: "1.0.0",
    isEmbeddedLaunch: false,
    isEmergencyLaunch: false,
    checkForUpdateAsync: async () => ({
      isAvailable: true,
      isRollBackToEmbedded: false,
      manifest: { id: "update-2" },
      reason: undefined,
    }),
    fetchUpdateAsync: async () => ({
      isNew: true,
      isRollBackToEmbedded: false,
      manifest: { id: "update-2" },
    }),
    reloadAsync: async () => {
      calls.reloads += 1;
    },
  };

  return { updates, calls };
};

test("an update is checked, downloaded and then restarted with what was prepared", async () => {
  const { updates, calls } = createUpdates();

  const beacon = new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "android",
      distribution: "store",
    },
    running: { boot: { id: "boot-1" } },
    routes: { ota: expoUpdates({ updates }) },
    clock: createTestClock(),
  });

  beacon.start();
  await beacon.check();

  const route = beacon.route("ota");
  const { observation } = route.state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer.");
  }

  const download = await route.download({ offer: observation.offer.ref });

  expect(download).toMatchObject({
    status: "accepted",
    receipt: { kind: "update-prepared", offered: "same" },
  });

  const { prepared } = route.state.get();

  if (prepared.status !== "ready") {
    throw new Error("Expected a prepared update.");
  }

  await route.reload({ prepared: prepared.value.ref });

  expect(calls.reloads).toBe(1);
});
```

The other adapters work the same way. `googlePlay({ bridge })` takes an object that keeps the `PlayBridge` contract. `serviceWorker({ container, registration })` takes fakes of the container and the registration. `appStoreHandoff({ appId, linking })` takes anything with `openURL`. `browserReload({ target })` takes anything with `location.reload()`. `http({ request })` takes your own function.

A test with a fake proves how Beacon maps a native result. It never proves that a Play update installed, that a service worker activated or that an Expo update launched. See [limits](limits.md).

## Your own adapters

The conformance suites of `@priemskiyyy/beacon/testing` (`testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism` and `testReleaseDriver`) register the contract every adapter keeps. [Custom adapters](custom-adapters.md#prove-it) shows how to call them.

## React

Render `BeaconProvider` around your component with a real Beacon over the mock source and the test clock, and drive it the way these tests do: answer, check, advance. Wrap what changes state in `act`. Reading in a hook never starts a session, so start the Beacon in the test, or pass `start` to the provider.
