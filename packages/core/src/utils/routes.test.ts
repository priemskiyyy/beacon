import { expect, test } from "vitest";

import { buildWebRelease, settle } from "src/utils/Beacon.fixture";
import {
  createTwoRouteBeacon,
  createWebBeacon,
  target,
} from "src/utils/routes.fixture";

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
    reasons.push(type === "check-requested" ? reason : null);
  });

  context.mock.answer({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
  });
  context.beacon.start();
  await context.beacon.check({ reason: "foreground" });

  expect(reasons).toContain("foreground");
});
