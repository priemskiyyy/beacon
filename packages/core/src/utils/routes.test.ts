import { expect, test } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import type { CandidateDecision } from "src/types/CandidateDecision";
import type { NoneDecision } from "src/types/NoneDecision";
import {
  buildWebRelease,
  createRoutedBeacon,
  settle,
} from "src/utils/Beacon.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { integer } from "src/utils/versions/integer";
import { newerRoute } from "src/utils/newerRoute";
import { targetRoute } from "src/utils/targetRoute";
import {
  createTwoRouteBeacon,
  createWebBeacon,
  target,
} from "src/utils/routes.fixture";
import type { Manifest } from "src/utils/routes.fixture";

type CandidateManifest = { binary: CandidateDecision<number> | NoneDecision };

const startAndCheck = async (context: ReturnType<typeof createWebBeacon>) => {
  context.beacon.start();

  const pending = context.beacon.route("web").check();

  await settle();
  context.mock.resolve({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: "208" },
    digest: "a",
    expiresAt: 601_000,
  });

  return pending;
};

test("CORE-01 a route is inert until a session starts, and its state is unknown", () => {
  const { beacon, mock } = createWebBeacon();
  const web = beacon.route("web");

  expect(web.state.get()).toEqual({
    revision: 0,
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
    prepared: { status: "not-applicable" },
    operation: { state: "idle" },
  });
  expect(web.native.get()).toBeNull();
  expect(mock.stats().reads).toBe(0);
});

test("Story A a rollback target with an older order is an offer once what runs is known", async () => {
  const context = createWebBeacon();
  const outcome = await startAndCheck(context);
  const { observation, check } = context.beacon.route("web").state.get();

  expect(outcome).toEqual({ status: "succeeded", attempt: 1 });
  expect(check).toMatchObject({ state: "succeeded", attempt: 1 });
  expect(observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
    evidence: {
      source: "manifest",
      origin: "network",
      freshness: "fresh",
      expiresAt: 601_000,
      revision: { kind: "ordered", value: "208" },
    },
  });
});

test("the native handle of a route is its mechanism's while a session runs", () => {
  const { beacon, environment } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  expect(web.native.get()).toBe(environment);

  beacon.stop();
  expect(web.native.get()).toBeNull();
});

test("a check before start fails as not started without reading anything", async () => {
  const { beacon, mock } = createWebBeacon();

  await expect(beacon.route("web").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "NOT_STARTED" },
  });
  expect(mock.stats().reads).toBe(0);
});

test("a check after dispose fails as disposed", async () => {
  const { beacon } = createWebBeacon();

  beacon.dispose();

  await expect(beacon.check()).resolves.toEqual({
    routes: {
      web: {
        status: "failed",
        attempt: 0,
        error: {
          code: "DISPOSED",
          message:
            "This Beacon was disposed. Create a new one to observe again.",
        },
      },
    },
    support: null,
  });
});

test("routeNames lists the routes as they were defined, and cannot be edited", () => {
  const { beacon } = createWebBeacon();

  expect(beacon.routeNames).toEqual(["web"]);
  expect(Object.isFrozen(beacon.routeNames)).toBe(true);
});

test("BIND-01 a route name that was never defined throws for untyped callers", () => {
  const { beacon } = createWebBeacon();

  expect(() => Reflect.apply(beacon.route, beacon, ["missing"])).toThrow(
    expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
  );
  expect(() => Reflect.apply(beacon.route, beacon, ["constructor"])).toThrow(
    expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
  );
});

test("CORE-03 an offer followed by a failed check stays with its evidence and the check says failed", async () => {
  const context = createWebBeacon();

  await startAndCheck(context);

  const second = context.beacon.route("web").check();

  await settle();
  context.mock.reject(new Error("offline"));

  await expect(second).resolves.toMatchObject({
    status: "failed",
    attempt: 2,
    error: { code: "SOURCE_FAILED" },
  });

  const { observation, check } = context.beacon.route("web").state.get();

  expect(observation.status).toBe("available");
  expect(check).toMatchObject({
    state: "failed",
    attempt: 2,
    error: { code: "SOURCE_FAILED" },
  });
});

test("CORE-04 an accepted no-offer replaces an earlier offer", async () => {
  const context = createWebBeacon();

  await startAndCheck(context);

  const second = context.beacon.route("web").check();

  await settle();
  context.mock.resolve({
    document: {
      web: { kind: "none", reason: "up-to-date" },
      policy: { minimum: "1.0.0" },
    },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: "209" },
    digest: "b",
  });
  await second;

  expect(context.beacon.route("web").state.get().observation).toMatchObject({
    status: "none",
    reason: "no-decision",
    detail: "up-to-date",
  });
});

test("VER-15 a renewed decision keeps the offer and its reference and refreshes only the evidence", async () => {
  const context = createWebBeacon();

  await startAndCheck(context);

  const held = context.beacon.route("web").state.get().observation;

  context.clock.advance(60_000);

  const second = context.beacon.route("web").check();

  await settle();
  context.mock.resolve({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: "208" },
    digest: "a",
    expiresAt: 661_000,
  });
  await second;

  const next = context.beacon.route("web").state.get().observation;

  if (held.status !== "available" || next.status !== "available") {
    throw new Error("Both observations should be available.");
  }

  expect(next.offer.ref).toBe(held.offer.ref);
  expect(next.evidence.receivedAt).toBe(61_000);
  expect(next.evidence.expiresAt).toBe(661_000);
});

test("HTTP-01 two routes of one source share a single read and one accepted document", async () => {
  const { beacon, mock } = createTwoRouteBeacon();

  beacon.start();

  const report = beacon.check();

  await settle();
  expect(mock.stats().reads).toBe(1);

  mock.resolve({
    document: { first: target("build-a"), second: target("build-a") },
  });

  await expect(report).resolves.toEqual({
    routes: {
      first: { status: "succeeded", attempt: 1 },
      second: { status: "succeeded", attempt: 1 },
    },
    support: null,
  });
  expect(beacon.route("first").state.get().observation.status).toBe(
    "available",
  );
  expect(beacon.route("second").state.get().observation.status).toBe(
    "available",
  );
});

test("HTTP-05 one check that asks for a read after the current one reads a shared source once, and asks again only for a read that was under way before it", async () => {
  const { beacon, mock } = createTwoRouteBeacon();
  const answer = { first: target("build-a"), second: target("build-a") };

  beacon.start();

  const report = beacon.check({ mode: "after-current" });

  await settle();
  expect(mock.stats().reads).toBe(1);

  mock.resolve({ document: answer });
  await settle();
  expect(mock.stats().reads).toBe(1);

  await expect(report).resolves.toMatchObject({
    routes: {
      first: { status: "succeeded", attempt: 1 },
      second: { status: "succeeded", attempt: 1 },
    },
  });

  const under = beacon.check();

  await settle();

  const after = beacon.check({ mode: "after-current" });

  await settle();
  mock.resolve({ document: answer });
  await settle();
  expect(mock.stats().reads).toBe(3);
  mock.resolve({ document: answer });

  await expect(under).resolves.toMatchObject({
    routes: { first: { attempt: 2 }, second: { attempt: 2 } },
  });
  await expect(after).resolves.toMatchObject({
    routes: { first: { attempt: 3 }, second: { attempt: 3 } },
  });
  expect(mock.stats().reads).toBe(3);
});

test("CORE-06 a snapshot, its offer and its evidence are frozen, and the release in the offer is the source's own object, kept as it is", async () => {
  const context = createWebBeacon();
  const decision = target("web-build-a");

  context.mock.answer({
    document: { web: decision, policy: { minimum: "1.0.0" } },
    expiresAt: 601_000,
  });
  context.beacon.start();
  await context.beacon.route("web").check();

  const snapshot = context.beacon.route("web").state.get();

  if (snapshot.observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  const { offer, evidence } = snapshot.observation;

  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.check)).toBe(true);
  expect(Object.isFrozen(snapshot.observation)).toBe(true);
  expect(Object.isFrozen(offer)).toBe(true);
  expect(Object.isFrozen(evidence)).toBe(true);
  expect(offer.release).toBe(decision.release);
  expect(Object.isFrozen(decision.release)).toBe(false);
});

test("HTTP-01 a selection that throws for one route of a shared source fails that route's check alone", async () => {
  const { beacon, mock } = createTwoRouteBeacon();

  beacon.start();

  const report = beacon.check();

  await settle();
  mock.resolve({
    document: {
      get first(): never {
        throw new Error("The projection threw.");
      },
      second: target("build-a"),
    },
  });

  await expect(report).resolves.toMatchObject({
    routes: {
      first: { status: "failed", error: { code: "SELECTION_FAILED" } },
      second: { status: "succeeded", attempt: 1 },
    },
  });
  expect(beacon.route("first").state.get().observation.status).toBe("unknown");
  expect(beacon.route("second").state.get().observation.status).toBe(
    "available",
  );
});

test("a running fact that changes selects again from the document held", async () => {
  const releases = ["web-build-a", "web-build-b"];

  const context = createWebBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => buildWebRelease(releases.shift() ?? "web-build-b"),
    },
  });

  context.mock.answer({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
  });
  context.beacon.start();
  await context.beacon.route("web").check();

  expect(context.beacon.route("web").state.get().observation).toMatchObject({
    status: "none",
    reason: "same-identity",
  });

  context.beacon.stop();
  context.beacon.start();
  await settle();

  expect(context.beacon.route("web").state.get().observation.status).toBe(
    "available",
  );
});

test("LIFE-01 a session that stops during a check supersedes it and keeps what was held", async () => {
  const context = createWebBeacon();

  await startAndCheck(context);

  const second = context.beacon.route("web").check();

  await settle();
  context.beacon.stop();

  await expect(second).resolves.toEqual({ status: "superseded" });
  expect(context.beacon.route("web").state.get().observation.status).toBe(
    "available",
  );
  expect(context.beacon.route("web").state.get().check).toMatchObject({
    state: "failed",
    error: { code: "ABORTED" },
  });
});

test("LIFE-01 a listener that stops the session as the last route opens leaves a document that passed its expiry as it was", async () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  await startAndCheck(context);
  context.beacon.stop();
  context.clock.suspend(700_000);

  web.native.subscribe(() => context.beacon.stop());
  context.beacon.start();

  expect(web.state.get().observation).toMatchObject({
    status: "available",
    evidence: { freshness: "fresh" },
  });
  expect(context.clock.pendingTimers()).toBe(0);
});

test("a selection that throws fails only the check and keeps the observation", async () => {
  const context = createWebBeacon();

  await startAndCheck(context);

  const second = context.beacon.route("web").check();

  await settle();
  context.mock.resolve({
    document: {
      get web(): never {
        throw new Error("The projection threw.");
      },
      policy: { minimum: "1.0.0" },
    },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: "209" },
  });

  await expect(second).resolves.toMatchObject({
    status: "failed",
    error: { code: "SELECTION_FAILED" },
  });
  expect(context.beacon.route("web").state.get().observation.status).toBe(
    "available",
  );
});

test("CORE-07 the route and the running facts change in the order their commits were made", async () => {
  const context = createWebBeacon();
  const seen: string[] = [];

  context.beacon.route("web").state.subscribe(() => {
    seen.push(
      `${context.beacon.route("web").state.get().observation.status}:${context.beacon.running.get().web.state}`,
    );
  });

  await startAndCheck(context);

  expect(seen.at(-1)).toBe("available:known");
});

test("an aborted caller leaves the shared read to the callers still waiting", async () => {
  const context = createWebBeacon();
  const controller = new AbortController();

  context.beacon.start();

  const leaving = context.beacon
    .route("web")
    .check({ signal: controller.signal });

  const staying = context.beacon.route("web").check();

  await settle();
  controller.abort();

  await expect(leaving).resolves.toEqual({ status: "cancelled" });
  expect(context.mock.contexts()[0]?.signal.aborted).toBe(false);

  context.mock.resolve({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
  });

  await expect(staying).resolves.toMatchObject({ status: "succeeded" });
});

test("a check requested with a reason records it for diagnostics", async () => {
  const context = createWebBeacon();
  const reasons: Array<string | null> = [];

  context.beacon.diagnostics.events.subscribe(({ type, reason }) => {
    reasons.push(type === "check-started" ? reason : null);
  });

  context.mock.answer({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
  });
  context.beacon.start();
  await context.beacon.check({ reason: "foreground" });

  expect(reasons).toContain("foreground");
});

test("CORE-07 a running fact that changes routes of several sources reaches a listener with every route already selected", async () => {
  const first = createMockSource<Manifest>({ name: "first" });
  const second = createMockSource<Manifest>({ name: "second" });
  const running = { build: "web-build-c" };

  const inert = createUpdateMechanism({
    name: "inert",
    open: () => ({ native: {} }),
    commands: {},
  });

  const route = (mock: typeof first) =>
    targetRoute({
      subject: "web",
      source: mock.source.select((manifest) => manifest.web),
      mechanism: inert,
    });

  const { beacon } = createRoutedBeacon(
    { first: route(first), second: route(second) },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease(running.build),
      },
    },
  );

  const answer = { web: target("web-build-a"), policy: { minimum: "1.0.0" } };

  first.answer({ document: answer });
  second.answer({ document: answer });
  beacon.start();
  await beacon.check();

  const seen: string[] = [];

  beacon.route("first").state.subscribe(() => {
    seen.push(
      `${beacon.running.get().web.state === "known" ? "known" : "pending"}:${beacon.route("first").state.get().observation.status}:${beacon.route("second").state.get().observation.status}`,
    );
  });

  running.build = "web-build-a";
  beacon.stop();
  beacon.start();
  await settle();

  expect(seen.filter((entry) => entry.startsWith("known"))).toEqual(
    seen.filter((entry) => entry === "known:none:none"),
  );
});

test("CORE-02 a selection that fails when a running fact changes shows on the check, and clears when it selects again", async () => {
  const mock = createMockSource<CandidateManifest>({ name: "manifest" });
  const running = { build: 100 };

  const binary = newerRoute({
    subject: "native",
    source: mock.source.select((manifest) => manifest.binary),
    version: integer(),
    current: (release) => {
      const build = Number(release?.raw["build"]);

      if (build === 999) {
        throw new Error("This build cannot be ordered.");
      }

      return build;
    },
    mechanism: createUpdateMechanism({
      name: "inert",
      open: () => ({ native: {} }),
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon(
    { binary },
    {
      running: {
        boot: { id: "boot-1" },
        native: () => ({
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "android-version-code",
            value: String(running.build),
          },
          label: `Build ${running.build}`,
          raw: { build: running.build },
        }),
      },
    },
  );

  mock.answer({
    document: {
      binary: {
        kind: "candidate",
        release: {
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "android-version-code",
            value: "120",
          },
          order: 120,
        },
      },
    },
  });

  const route = beacon.route("binary");

  beacon.start();
  await route.check();

  expect(route.state.get()).toMatchObject({
    check: { state: "succeeded" },
    observation: { status: "available" },
  });

  running.build = 999;
  beacon.stop();
  beacon.start();
  await settle();

  expect(route.state.get().check).toMatchObject({
    state: "failed",
    error: { code: "SELECTION_FAILED" },
  });

  running.build = 100;
  beacon.stop();
  beacon.start();
  await settle();

  expect(route.state.get().check).toMatchObject({ state: "succeeded" });
});

test("CORE-01 every observable can be read as it was before any session, which is what a server renders", async () => {
  const context = createWebBeacon();
  const { beacon } = context;
  const web = beacon.route("web");

  const before = {
    status: beacon.status.get(),
    running: beacon.running.get(),
    support: beacon.support.get(),
    transitions: beacon.transitions.get(),
    diagnostics: beacon.diagnostics.get(),
    route: web.state.get(),
    native: web.native.get(),
  };

  await startAndCheck(context);

  expect(beacon.status.getInitial()).toEqual(before.status);
  expect(beacon.running.getInitial()).toEqual(before.running);
  expect(beacon.support.getInitial()).toEqual(before.support);
  expect(beacon.transitions.getInitial()).toEqual(before.transitions);
  expect(beacon.diagnostics.getInitial()).toEqual(before.diagnostics);
  expect(web.state.getInitial()).toEqual(before.route);
  expect(web.native.getInitial()).toEqual(before.native);
  expect(web.state.get()).not.toEqual(web.state.getInitial());
});

test("LIFE-04 a mechanism that throws while it opens fails its route's native handle and leaves start and the check alone", async () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const events: string[] = [];

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "broken",
      open: () => {
        throw new Error("There is no window.");
      },
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease("web-build-b"),
      },
    },
  );

  beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });
  mock.answer({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
  });

  expect(() => beacon.start()).not.toThrow();
  expect(beacon.route("web").native.get()).toBeNull();
  expect(events).toContain("route-failed:web:DRIVER_FAILED");

  await expect(beacon.route("web").check()).resolves.toMatchObject({
    status: "succeeded",
  });
  expect(beacon.route("web").state.get().observation.status).toBe("available");
});

test("CORE-02 a document that expires while a newer read is under way leaves that read's check alone", async () => {
  const context = createWebBeacon();

  await startAndCheck(context);
  context.clock.advance(595_000);

  const second = context.beacon.route("web").check();

  await settle();
  context.clock.advance(5_000);

  expect(context.beacon.route("web").state.get()).toMatchObject({
    check: { state: "checking", attempt: 2 },
    observation: { status: "available", evidence: { freshness: "expired" } },
  });

  context.mock.reject(new Error("offline"));
  await second;
});
