import { afterEach, expect, test, vi } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RouteBody } from "src/types/RouteBody";
import { settle } from "src/mock/settle";
import {
  buildWebRelease,
  createRoutedBeacon,
  SCOPE,
} from "src/utils/Beacon.fixture";
import {
  BODY,
  createDriverBeacon,
  createFakeDriver,
} from "src/utils/drivers.fixture";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { target } from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";
import type { Manifest } from "src/utils/routes.fixture";

afterEach(() => {
  vi.useRealTimers();
});

const startWithOffer = async (
  context: ReturnType<typeof createDriverBeacon>,
) => {
  context.beacon.start();
  await context.ota.check();

  const { observation } = context.ota.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  return observation.offer.ref;
};

test("CORE-05 a prepared target and a new operation's progress stay distinguishable until the provider invalidates", async () => {
  const context = createDriverBeacon();
  const offer = await startWithOffer(context);

  context.emitter()?.prepared({ status: "ready", value: BODY });

  const downloading = context.ota.download({ offer });

  await settle();
  context.emitter()?.progress(0.5);

  expect(context.ota.state.get()).toMatchObject({
    prepared: { status: "ready" },
    operation: { state: "running", command: "download", progress: 0.5 },
  });

  context.emitter()?.prepared({ status: "none" });

  expect(context.ota.state.get()).toMatchObject({
    prepared: { status: "none" },
    operation: { state: "running", progress: 0.5 },
  });

  context.downloads[0]?.settleWith({
    status: "accepted",
    receipt: { kind: "downloaded" },
  });
  await downloading;
});

test("CORE-04 an accepted no-offer after an offer changes the observation to none and leaves an independently prepared target alone", async () => {
  const context = createDriverBeacon();

  await startWithOffer(context);
  context.emitter()?.prepared({ status: "ready", value: BODY });

  const { prepared } = context.ota.state.get();

  context.emitter()?.observation({
    status: "none",
    reason: "no-decision",
    detail: "noUpdateAvailableOnServer",
  });

  expect(context.ota.state.get().observation).toMatchObject({
    status: "none",
    reason: "no-decision",
  });
  expect(context.ota.state.get().prepared).toBe(prepared);
});

test("LIFE-04 a driver that fails to open leaves an unrelated route usable, and says which failed", async () => {
  const broken = createFakeDriver({ failOpen: new Error("no native module") });
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const events: string[] = [];

  const web = targetRoute({
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "inert",
      subject: "web",
      open: () => ({ native: {} }),
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon(
    { ota: broken.route, web },
    { running: { web: () => buildWebRelease("web-build-b") } },
  );

  beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });
  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  mock.resolve({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
    expiresAt: 601_000,
  });

  await expect(checking).resolves.toMatchObject({ status: "succeeded" });
  expect(beacon.route("ota").native.get()).toBeNull();
  expect(events).toContain("route-failed:ota:DRIVER_FAILED");
  await expect(beacon.route("ota").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
});

test("LIFE-05 a provider that reports while it opens is heard once, and starting again opens nothing more", async () => {
  const context = createDriverBeacon({
    emitOnOpen: { status: "available", offer: BODY },
  });

  const stop = context.beacon.start();

  expect(context.ota.state.get().observation).toMatchObject({
    status: "available",
  });
  expect(context.ota.state.get().revision).toBe(1);

  expect(context.beacon.start()).toBe(stop);
  expect(context.counts.opens).toBe(1);
});

test("a report that arrives after the session ended is dropped and counted", async () => {
  const context = createDriverBeacon();

  context.beacon.start();

  const emitter = context.emitter();

  context.beacon.stop();
  emitter?.observation({ status: "available", offer: BODY });

  expect(context.ota.state.get().observation).toMatchObject({
    status: "unknown",
  });
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(1);
});

test("LIFE-07 disposing while a provider operation continues leaves the outcome unknown, never cancelled", async () => {
  const context = createDriverBeacon();
  const offer = await startWithOffer(context);
  const downloading = context.ota.download({ offer });

  await settle();
  context.beacon.dispose();

  await expect(downloading).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  expect(context.downloads[0]?.signal.aborted).toBe(true);
});

test("LIFE-12 a handle kept after dispose reads a stable final snapshot and reopens nothing", async () => {
  const context = createDriverBeacon();

  await startWithOffer(context);

  const held = context.ota;
  const before = held.state.get();

  context.beacon.dispose();

  expect(held.state.get()).toBe(before);
  expect(held.native.get()).toBeNull();
  expect(held.state.subscribe(() => {})).toBeTypeOf("function");
  await expect(held.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DISPOSED" },
  });
  expect(context.counts.opens).toBe(1);
  expect(context.counts.disposals).toBe(1);
});

test("a provider's session is disposed once, and only the resources it made are its own", async () => {
  const context = createDriverBeacon();

  context.beacon.start();
  context.beacon.stop();
  context.beacon.start();
  context.beacon.stop();

  expect(context.counts).toEqual({ opens: 2, disposals: 2 });
  expect(context.native.label).toBe("fake provider");
});

test("LIFE-11 a second Beacon cannot open a route on a manager the first holds, and says so", async () => {
  const manager = {};
  const first = createDriverBeacon({}, manager);
  const second = createDriverBeacon({}, manager);
  const events: string[] = [];

  second.beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });

  first.beacon.start();
  second.beacon.start();

  expect(first.counts.opens).toBe(1);
  expect(second.counts.opens).toBe(0);
  expect(second.ota.native.get()).toBeNull();
  expect(events).toContain("route-failed:ota:DRIVER_FAILED");
  await expect(second.ota.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
});

test("LIFE-11 the manager is free again once the holder stops, and a driver that fails to open frees it", async () => {
  const manager = {};
  const first = createDriverBeacon({}, manager);

  const failing = createDriverBeacon(
    { failOpen: new Error("no module") },
    manager,
  );

  const second = createDriverBeacon({}, manager);

  const stop = first.beacon.start();

  stop();
  failing.beacon.start();
  failing.beacon.stop();
  second.beacon.start();

  expect(second.counts.opens).toBe(1);
  expect(second.ota.native.get()).not.toBeNull();
});

test("LIFE-11 a driver without an exclusive manager is opened by any number of Beacons", () => {
  const first = createDriverBeacon();
  const second = createDriverBeacon();

  first.beacon.start();
  second.beacon.start();

  expect(first.counts.opens + second.counts.opens).toBe(2);
});

test("LIFE-02 a session that a status listener starts again opens its routes once and keeps them", async () => {
  const context = createDriverBeacon();

  context.beacon.status.subscribe(() => {
    if (context.beacon.status.get().state !== "stopped") {
      return;
    }

    context.beacon.start();
  });

  context.beacon.start();
  context.beacon.stop();

  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(context.counts.opens).toBe(2);
  expect(context.counts.disposals).toBe(1);
  expect(context.ota.native.get()).not.toBeNull();
  await expect(context.ota.check()).resolves.toMatchObject({
    status: "succeeded",
  });
});

test("LIFE-02 a listener that starts again and is then disposed leaves no session open", () => {
  const context = createDriverBeacon();
  let restarted = false;

  context.beacon.status.subscribe(() => {
    if (context.beacon.status.get().state !== "stopped" || restarted) {
      return;
    }

    restarted = true;
    context.beacon.start();
    context.beacon.dispose();
  });

  context.beacon.start();
  context.beacon.stop();

  expect(context.beacon.status.get()).toEqual({ state: "disposed" });
  expect(context.counts.opens).toBe(2);
  expect(context.counts.disposals).toBe(2);
});

test("LIFE-04 a driver that throws while it reconciles fails its route and leaves start and the others alone", async () => {
  const broken = createFakeDriver({
    reconcile: () => {
      throw new Error("cannot read local state");
    },
  });

  const healthy = createFakeDriver();

  const { beacon } = createRoutedBeacon({
    broken: broken.route,
    healthy: healthy.route,
  });

  const events: string[] = [];

  beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });

  expect(() => beacon.start()).not.toThrow();
  await settle();

  expect(events).toContain("route-failed:broken:DRIVER_FAILED");
  expect(healthy.counts.opens).toBe(1);
  expect(beacon.route("healthy").native.get()).not.toBeNull();
});

test("LIFE-11 a driver whose dispose throws still gives its native manager back, so the next session opens", () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const manager = {};

  const context = createDriverBeacon(
    { throwOnDispose: new Error("unsubscribe failed") },
    manager,
  );

  context.beacon.start();
  context.beacon.stop();

  expect(() => vi.runAllTicks()).toThrow("unsubscribe failed");

  context.beacon.start();

  expect(context.counts.opens).toBe(2);
  expect(context.ota.native.get()).not.toBeNull();
});

test("LIFE-02 a listener that stops the session as a provider opens leaves it disposed and never reconciled", () => {
  const reconcile = vi.fn(async () => {});
  const context = createDriverBeacon({ reconcile });

  context.ota.native.subscribe(() => context.beacon.stop());
  context.beacon.start();

  expect(context.counts).toEqual({ opens: 1, disposals: 1 });
  expect(reconcile).not.toHaveBeenCalled();
  expect(context.ota.native.get()).toBeNull();
});

test("LIFE-02 a listener that restarts the session as a provider opens leaves the new session with its provider open", () => {
  const context = createDriverBeacon();

  let restarted = false;

  context.ota.native.subscribe(() => {
    if (restarted || context.ota.native.get() === null) {
      return;
    }

    restarted = true;
    context.beacon.stop();
    context.beacon.start();
  });
  context.beacon.start();

  // The session that ended is let go of when it ends, not after the next one opened: it takes nothing from the next.
  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(context.counts).toEqual({ opens: 2, disposals: 1 });
  expect(context.ota.native.get()).not.toBeNull();
});

test("LIFE-02 a listener that replaces the scope as a provider opens leaves the new session with its provider open, even one that holds a manager of its own", () => {
  const context = createDriverBeacon({}, {});

  let replaced = false;

  context.ota.native.subscribe(() => {
    if (replaced || context.ota.native.get() === null) {
      return;
    }

    replaced = true;
    context.beacon.replaceScope({ ...SCOPE, environment: "staging" });
  });
  context.beacon.start();

  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(context.counts).toEqual({ opens: 2, disposals: 1 });
  expect(context.ota.native.get()).not.toBeNull();
});

test("LIFE-02 a diagnostics listener that starts the next session on the end of one finds the manager of the first let go of", () => {
  const context = createDriverBeacon({}, {});

  let restarted = false;

  context.beacon.diagnostics.events.subscribe((event) => {
    if (event.type !== "session-stopped" || restarted) {
      return;
    }

    restarted = true;
    context.beacon.start();
  });
  context.beacon.start();
  context.beacon.stop();

  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(context.counts).toEqual({ opens: 2, disposals: 1 });
  expect(context.ota.native.get()).not.toBeNull();
});

test("LIFE-02 a listener that disposes the Beacon as a provider opens leaves no provider handle behind", () => {
  const context = createDriverBeacon();

  context.ota.native.subscribe(() => {
    context.beacon.dispose();
  });
  context.beacon.start();

  expect(context.counts).toEqual({ opens: 1, disposals: 1 });
  expect(context.ota.native.get()).toBeNull();
});

test("LIFE-02 a listener that stops the session as the provider reports while it opens leaves it disposed, with no handle published", () => {
  const reconcile = vi.fn(async () => {});

  const context = createDriverBeacon({
    emitOnOpen: { status: "available", offer: BODY },
    reconcile,
  });

  context.ota.state.subscribe(() => context.beacon.stop());
  context.beacon.start();

  expect(context.counts).toEqual({ opens: 1, disposals: 1 });
  expect(reconcile).not.toHaveBeenCalled();
  expect(context.ota.native.get()).toBeNull();
});

test("LIFE-02 a listener that stops the session while routes open leaves the routes after it unopened", () => {
  const first = createFakeDriver();
  const second = createFakeDriver();

  const { beacon } = createRoutedBeacon({
    first: first.route,
    second: second.route,
  });

  beacon.route("first").native.subscribe(() => beacon.stop());
  beacon.start();

  expect(first.counts).toEqual({ opens: 1, disposals: 1 });
  expect(second.counts).toEqual({ opens: 0, disposals: 0 });
});

test("LIFE-04 a reconcile that fails because its session ended is a late callback, not a failed route", async () => {
  const context = createDriverBeacon({
    reconcile: (signal) =>
      new Promise<void>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("The session ended.")),
          {
            once: true,
          },
        );
      }),
  });

  const events: string[] = [];

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(event.type);
  });
  context.beacon.start();
  context.beacon.stop();
  await settle();

  expect(events).not.toContain("route-failed");
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(1);
});

test("CORE-06 a provider that repeats a prepared report or a progress fraction changes nothing and tells nobody", async () => {
  const context = createDriverBeacon();
  const offer = await startWithOffer(context);
  const emitter = context.emitter();

  emitter?.prepared({ status: "ready", value: BODY });

  const downloading = context.ota.download({ offer });

  await settle();
  emitter?.progress(0.5);

  const held = context.ota.state.get();
  const heard = vi.fn();

  context.ota.state.subscribe(heard);
  emitter?.prepared({ status: "ready", value: BODY });
  emitter?.progress(0.5);

  expect(context.ota.state.get()).toBe(held);
  expect(heard).not.toHaveBeenCalled();

  emitter?.progress(0.75);
  emitter?.prepared({ status: "none" });
  emitter?.prepared({ status: "none" });

  expect(heard).toHaveBeenCalledTimes(2);
  expect(context.ota.state.get().revision).toBe(held.revision + 2);

  context.downloads[0]?.settleWith({ status: "unsupported", reason: "test" });
  await downloading;
});

test("CORE-06 a fraction reported while no operation runs is dropped", async () => {
  const context = createDriverBeacon();

  await startWithOffer(context);

  const held = context.ota.state.get();

  context.emitter()?.progress(0.5);

  expect(context.ota.state.get()).toBe(held);
});

test("a prepared target the provider confirms again keeps its reference until the release changes", () => {
  const context = createDriverBeacon();

  const readReference = () => {
    const { prepared } = context.ota.state.get();

    if (prepared.status !== "ready") {
      throw new Error("Nothing is prepared.");
    }

    return prepared.value.ref;
  };

  context.beacon.start();
  context.emitter()?.prepared({ status: "ready", value: BODY });

  const first = readReference();

  context.emitter()?.prepared({ status: "ready", value: BODY });
  expect(readReference()).toBe(first);

  context.emitter()?.prepared({
    status: "ready",
    value: {
      release: {
        identity: {
          status: "known",
          authority: "com.example.notes",
          domain: "android-version-code",
          value: "121",
        },
      },
    },
  });
  expect(readReference()).not.toBe(first);
});

test("a disruptive command of a driver route is journaled against the subject its provider replaces", async () => {
  const memory = createMockJournalStorage();

  const restarting = createReleaseDriver({
    name: "restarting",
    subject: "bundle",
    prepares: false,
    open: () => ({
      native: {},
      check: async (): Promise<ObservationDraft<RouteBody>> => ({
        status: "unknown",
        reason: "unsupported-environment",
      }),
    }),
    commands: {
      restart: {
        reference: "none",
        impacts: ["javascript-restart"],
        binding: "provider-current",
        run: async (): Promise<
          ProviderResult<{ kind: "restart-requested" }>
        > => ({
          status: "accepted",
          receipt: { kind: "restart-requested" },
        }),
      },
    },
  });

  const { beacon } = createRoutedBeacon(
    { ota: restarting },
    { journal: { mode: "best-effort", storage: memory } },
  );

  beacon.start();
  await settle();

  await expect(beacon.route("ota").restart()).resolves.toMatchObject({
    status: "accepted",
  });
  expect(beacon.transitions.get().latest).toMatchObject({
    intent: { route: "ota", command: "restart", subject: "bundle" },
  });
});

test("LIFE-04 a provider that answers what is no observation fails its check, keeps what was held and leaves the route usable", async () => {
  const answers = ['{"status":"available"}', '{"status":"banana"}', "null"];

  for (const answer of answers) {
    const { beacon } = createRoutedBeacon({
      ota: createReleaseDriver({
        name: "garbling",
        subject: "native",
        prepares: false,
        open: () => ({
          native: {},
          check: async (): Promise<ObservationDraft<RouteBody>> =>
            JSON.parse(answer),
        }),
        commands: {},
      }),
    });

    beacon.start();

    await expect(beacon.route("ota").check()).resolves.toMatchObject({
      status: "failed",
      error: { code: "DRIVER_FAILED" },
    });
    expect(beacon.route("ota").state.get()).toMatchObject({
      check: { state: "failed", error: { code: "DRIVER_FAILED" } },
      observation: { status: "unknown", reason: "not-checked" },
    });
    expect(beacon.route("ota").native.get()).not.toBeNull();
  }
});

test("LIFE-04 a provider that reports what is no observation or no prepared target is contained, and the route keeps what it held", async () => {
  const context = createDriverBeacon();
  const events: string[] = [];

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });
  context.beacon.start();
  await context.ota.check();

  const held = context.ota.state.get();
  const emitter = context.emitter();

  expect(() =>
    emitter?.observation(JSON.parse('{"status":"banana"}')),
  ).not.toThrow();
  expect(() => emitter?.observation(JSON.parse("null"))).not.toThrow();
  expect(() =>
    emitter?.prepared(JSON.parse('{"status":"ready"}')),
  ).not.toThrow();
  expect(() => emitter?.prepared(JSON.parse("null"))).not.toThrow();

  expect(context.ota.state.get()).toBe(held);
  expect(
    events.filter((event) => event === "route-failed:ota:DRIVER_FAILED"),
  ).toHaveLength(4);
});

test("CORE-05 a progress that is no fraction between 0 and 1 is published as unknown, never as a number to show", async () => {
  const context = createDriverBeacon();
  const offer = await startWithOffer(context);
  const emitter = context.emitter();
  const downloading = context.ota.download({ offer });

  await settle();

  const reported = [];

  for (const fraction of [0, 0.5, 1, 1.5, -0.1, Number.NaN, Infinity, 0.25]) {
    emitter?.progress(fraction);

    const { operation } = context.ota.state.get();

    reported.push(operation.state === "running" ? operation.progress : "idle");
  }

  expect(reported).toEqual([0, 0.5, 1, null, null, null, null, 0.25]);

  context.downloads[0]?.settleWith({ status: "unsupported", reason: "test" });
  await downloading;
});

test("CORE-05 a provider that declared it prepares nothing cannot make its route prepare", () => {
  const emitters: Array<DriverEmitter<RouteBody, RouteBody>> = [];
  const events: string[] = [];

  const { beacon } = createRoutedBeacon({
    ota: createReleaseDriver({
      name: "unpreparing",
      subject: "native",
      prepares: false,
      open: ({ emit }) => {
        emitters.push(emit);

        return {
          native: {},
          check: async (): Promise<ObservationDraft<RouteBody>> => ({
            status: "unknown",
            reason: "unsupported-environment",
          }),
        };
      },
      commands: {},
    }),
  });

  beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.route}:${event.reason}`);
  });
  beacon.start();

  const held = beacon.route("ota").state.get();

  emitters[0]?.prepared({ status: "none" });
  emitters[0]?.prepared({ status: "ready", value: BODY });

  expect(beacon.route("ota").state.get()).toBe(held);
  expect(held.prepared).toEqual({ status: "not-applicable" });
  expect(events.filter((event) => event.startsWith("route-failed"))).toEqual([
    "route-failed:ota:DRIVER_FAILED",
    "route-failed:ota:DRIVER_FAILED",
  ]);
});

test("BIND-03 a provider cannot claim a reference: the offer keeps the one Beacon minted", async () => {
  type ClaimingOffer = RouteBody & { ref: string };

  const claiming: ClaimingOffer = { ...BODY, ref: "claimed" };

  const { beacon } = createRoutedBeacon({
    ota: createReleaseDriver({
      name: "claiming",
      subject: "native",
      prepares: false,
      open: () => ({
        native: {},
        check: async (): Promise<ObservationDraft<ClaimingOffer>> => ({
          status: "available",
          offer: claiming,
        }),
      }),
      commands: {},
    }),
  });

  beacon.start();
  await beacon.route("ota").check();

  const { observation } = beacon.route("ota").state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  expect(observation.offer.ref).toMatchObject({ kind: "offer", route: "ota" });
});

test("CORE-14 a provider that answers unknown or nothing is published as it said, with itself as the evidence", async () => {
  const answers: Array<ObservationDraft<RouteBody>> = [
    { status: "unknown", reason: "unsupported-environment" },
    { status: "none", reason: "no-decision", detail: "up-to-date" },
  ];

  const observations = [];

  for (const answer of answers) {
    const context = createDriverBeacon({ answers: answer });

    context.beacon.start();
    await context.ota.check();
    observations.push(context.ota.state.get().observation);
  }

  expect(observations).toEqual([
    { status: "unknown", reason: "unsupported-environment" },
    {
      status: "none",
      evidence: expect.objectContaining({
        source: "fake-driver",
        origin: "provider",
      }),
      reason: "no-decision",
      detail: "up-to-date",
      candidate: null,
    },
  ]);
});
