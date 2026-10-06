---
description: "Test Beacon without a browser or a device: the mock source and the test clock, adapter fakes, held reads, expiry and timeouts, and the conformance suites."
---

# Testing

Everything Beacon does runs in process against fakes, so your tests do too. No browser, no device and no network is needed. Time is a clock you move, and a read is a promise you settle.

Two subpaths help:

- `@priemskiyyy/beacon/mock` has `createMockSource`, `createTestClock`, `createMockJournalStorage`, and `createGate` and `settle` for faking a provider that answers later.
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

`createTestClock({ now })` is a manual `BeaconClock`. Pass it as `clock` to the Beacon, and Beacon reads no other time source. Do not use `vi.useFakeTimers()` for Beacon. Code that schedules beside a Beacon, such as an integration that checks now and then, reads `beacon.clock` for the time and for its timers, so the same test clock moves it too.

| Member            | Does                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `advance(ms)`     | moves time forward, running every timer that falls due on the way, at its own time, and those already due when it is `0` |
| `suspend(ms)`     | moves time forward without running a timer, as a frozen page or a suspended runtime does                                 |
| `setNow(epoch)`   | sets epoch time alone, backwards included, as a clock correction does                                                    |
| `pendingTimers()` | timers armed and neither run nor cancelled                                                                               |

`advance` and `suspend` refuse a negative or non-finite number. A host clock whose `setTimer` throws is contained: a read or a settlement that needed the timer fails, and a document whose expiry timer cannot be armed is treated as expired.

## A fixture

One helper builds a Beacon over the mock source, the test clock and a fake window. Every test below uses it.

```ts
// src/testBeacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  JournalOptions,
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

export const createTestBeacon = (
  options: { journal?: JournalOptions } = {},
) => {
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
    ...options,
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

## A journal storage

`createMockJournalStorage()` is an in-memory `JournalStorage` with knobs, so a test decides what a write does. Pass it as `journal.storage`.

| Member                              | Does                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `records`                           | what is stored, by key: seed the record an earlier boot left, and read what the journal wrote |
| `reads()`, `writes()`               | how many the journal has made, those held and those refused included                          |
| `holdWrites()`, `releaseWrites()`   | holds every write from now on until released, and lets the held ones go                       |
| `holdReads()`, `releaseReads()`     | the same for reads                                                                            |
| `failWrites(error?)`, `failReads()` | refuses every write or read from now on, until `failWrites(null)` or `failReads(null)`        |

```ts
import { createMockJournalStorage } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { createTestBeacon, deploy } from "src/testBeacon";

test("a reload is not requested when its intent cannot be written", async () => {
  const storage = createMockJournalStorage();
  const { beacon, mock, reloads } = createTestBeacon({
    journal: { mode: "required", storage },
  });

  mock.answer({ document: deploy("web-build-b") });
  beacon.start();
  await beacon.check();

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("Expected an offer.");
  }

  storage.failWrites(new Error("quota exceeded"));

  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });

  expect(outcome).toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(reloads.count).toBe(0);
  expect(beacon.transitions.get().journal).toBe("degraded");
});
```

A storage of your own is held to its contract by `testJournalStorage`. See [custom adapters](custom-adapters.md#prove-it).

## A running reader

A reader answers what runs, and the journal compares what it answers exactly: a space after a build number is a build that never matches itself. `testRunningReader({ name, create, situations })` holds a reader to the contract over a fake of its host.

- **Cold.** Creating it asks the host for nothing, and reading it does. Give `reads` from the fixture, the number of times the reader asked its host, and the suite checks both. A reader over a constant has no host to count and leaves it out.
- **A release Beacon can publish.** A known identity has an authority, a domain and a value that are not empty and have no space around them, and an unknown one says why. The label is null or a text, and `raw` holds texts, numbers, booleans and null that survive a copy.
- **The same on every read.** The same state answers the same release each time, and a reader can be read again.
- **Never a throw.** A reader that cannot read says so by answering an unknown identity, or by rejecting, which Beacon publishes as a failed fact. Beacon survives a reader that throws, and the suite still fails it, since a throw is neither answer.

`situations` are the other states of the host, such as one that cannot name the build. Each says what the reader must answer in it: `known`, `unknown` or `rejection`.

```ts
import { testRunningReader } from "@priemskiyyy/beacon/testing";
import { expoBundle } from "@priemskiyyy/beacon-expo";
import type { UpdatesLike } from "@priemskiyyy/beacon-expo";

const createHost = (updateId: string | null) => {
  const host = { asked: 0 };

  const updates: UpdatesLike = {
    isEnabled: updateId !== null,
    updateId,
    channel: "production",
    runtimeVersion: "1.0.0",
    isEmbeddedLaunch: false,
    isEmergencyLaunch: false,
    checkForUpdateAsync: async () => {
      throw new Error("Not used by a reader.");
    },
    fetchUpdateAsync: async () => {
      throw new Error("Not used by a reader.");
    },
    reloadAsync: async () => {},
  };

  // Every member the reader touches is counted as an ask.
  const counted = new Proxy(updates, {
    get: (target, key, receiver) => {
      host.asked += 1;

      return Reflect.get(target, key, receiver);
    },
  });

  return { reader: expoBundle(counted), reads: () => host.asked };
};

testRunningReader({
  name: "expo bundle",
  create: () => createHost("8b2d5c1e-0a3f-4c8e-9d1b-6e7f2a4c5b90"),
  situations: [
    {
      name: "updates are disabled",
      answers: "unknown",
      create: () => createHost(null),
    },
  ],
});
```

It cannot check that the identity is the one the host reports, or that it is written in the domain the route paired with it compares. Keep those in the reader's own tests.

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

The other adapters work the same way. `googlePlay({ bridge })` takes an object that keeps the `PlayBridge` contract. `codePushUpdates({ codePush })` takes an object with the members of `CodePushLike`, whose packages are objects with `download` and `install` methods. `serviceWorker({ container, registration })` takes fakes of the container and the registration. `appStoreHandoff({ appId, linking })` takes anything with `openURL`. `browserReload({ target })` takes anything with `location.reload()`. `http({ fetch })` takes your own function. `firebaseRemoteConfig({ remoteConfig, sdk, document })` takes an instance and the three functions of the SDK module it calls.

### A fake that answers later

A fake provider that should be slow waits at a gate. `createGate()` is open until the test holds it: while it is held, `wait()` does not resolve, and `release()` opens it and lets every waiter go. `settle()` lets every queued promise continuation run before the test goes on. It is a yield, never a wait for time.

```ts
import { createGate, settle } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

const createSlowUpdates = () => {
  const gate = createGate();
  const calls = { fetches: 0 };

  const fetchUpdate = async () => {
    calls.fetches += 1;

    await gate.wait();

    return { id: "update-2" };
  };

  return { gate, calls, fetchUpdate };
};

test("a fake that waits at a gate answers only when the test releases it", async () => {
  const { gate, calls, fetchUpdate } = createSlowUpdates();
  const answers: string[] = [];

  gate.hold();

  fetchUpdate().then(({ id }) => {
    answers.push(id);
  });
  await settle();

  expect(calls.fetches).toBe(1);
  expect(answers).toEqual([]);

  gate.release();
  await settle();

  expect(answers).toEqual(["update-2"]);
});
```

A test with a fake proves how Beacon maps a native result. It never proves that a Play update installed, that a service worker activated or that an Expo update launched. See [limits](limits.md).

## Your own adapters

The conformance suites of `@priemskiyyy/beacon/testing` (`testReleaseSource`, `testVersionStrategy`, `testUpdateMechanism`, `testReleaseDriver`, `testJournalStorage` and `testRunningReader`) register the contract every adapter keeps. [Custom adapters](custom-adapters.md#prove-it) shows how to call them.

## The framework bindings

Render `BeaconProvider` around your component with a real Beacon over the mock source and the test clock, and drive it the way these tests do: answer, check, advance. Reading in a hook never starts a session, so start the Beacon in the test, or pass `start` to the provider. In React, wrap what changes state in `act`. The pages for [Vue](vue.md#testing), [Solid](solid.md#testing) and [Svelte](svelte.md#testing) show how to flush their own updates.
