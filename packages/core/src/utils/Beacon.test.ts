import { afterEach, expect, test, vi } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import type { ReleaseScope } from "src/types/ReleaseScope";
import { Beacon } from "src/utils/Beacon";
import { settle } from "src/mock/settle";
import {
  SCOPE,
  buildWebRelease,
  createBeacon,
  createRoutedBeacon,
} from "src/utils/Beacon.fixture";
import {
  createWebCommandBeacon,
  startWithOffer,
} from "src/utils/commands.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { buildIntent, buildStored, seed } from "src/utils/journal.fixture";
import { createPolicyBeacon } from "src/utils/policy.fixture";
import type { Manifest } from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";

test("CORE-01 constructing arms no timer, reads no clock and calls no reader", () => {
  const clock = createTestClock();
  const now = vi.fn(clock.now);

  const reader = vi.fn(() => {
    throw new Error("A reader must not run before start.");
  });

  const beacon = new Beacon({
    scope: SCOPE,
    routes: {},
    running: { boot: { id: "boot-1" }, web: reader },
    clock: { ...clock, now },
  });

  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(beacon.running.get()).toMatchObject({
    boot: { id: "boot-1" },
    revision: 0,
    web: { state: "pending" },
    native: { state: "unconfigured" },
  });
  expect(reader).not.toHaveBeenCalled();
  expect(clock.pendingTimers()).toBe(0);
  expect(now).not.toHaveBeenCalled();
});

afterEach(() => {
  vi.useRealTimers();
});

test("the clock a Beacon runs on is the one it was given, and reading it starts nothing", () => {
  const clock = createTestClock({ now: 5_000 });
  const now = vi.fn(clock.now);

  const given = { ...clock, now };

  const beacon = new Beacon({
    scope: SCOPE,
    routes: {},
    running: { boot: { id: "boot-1" } },
    clock: given,
  });

  expect(beacon.clock).toBe(given);
  expect(now).not.toHaveBeenCalled();
  expect(clock.pendingTimers()).toBe(0);
});

test("a timer armed on beacon.clock runs when the test clock passed to the Beacon advances", () => {
  const { beacon, clock } = createBeacon();
  const fired = vi.fn();
  const cancelled = vi.fn();

  expect(beacon.clock).toBe(clock);

  beacon.clock.setTimer(fired, 50);
  beacon.clock.setTimer(cancelled, 50)();

  expect(beacon.clock.now()).toBe(1_000);

  clock.advance(50);

  expect(fired).toHaveBeenCalledTimes(1);
  expect(cancelled).not.toHaveBeenCalled();
  expect(beacon.clock.now()).toBe(1_050);
});

test("a Beacon given no clock runs on the host's: its time and its timers", () => {
  vi.useFakeTimers();
  vi.setSystemTime(123_456);

  const beacon = new Beacon({
    scope: SCOPE,
    routes: {},
    running: { boot: { id: "boot-1" } },
  });

  const fired = vi.fn();
  const cancelled = vi.fn();

  expect(beacon.clock.now()).toBe(123_456);

  beacon.clock.setTimer(fired, 100);
  beacon.clock.setTimer(cancelled, 100)();
  vi.advanceTimersByTime(100);

  expect(fired).toHaveBeenCalledTimes(1);
  expect(cancelled).not.toHaveBeenCalled();
  expect(beacon.clock.now()).toBe(123_556);
});

test("CORE-01 reading and subscribing start nothing, and the observables work detached", () => {
  const { beacon, clock } = createBeacon();
  const listener = vi.fn();
  const { get, subscribe } = beacon.status;

  subscribe(listener);
  beacon.running.subscribe(listener);
  beacon.diagnostics.subscribe(listener);

  expect(get()).toBe(get());
  expect(clock.pendingTimers()).toBe(0);
  expect(listener).not.toHaveBeenCalled();
});

test("starting publishes the running status with the session number", () => {
  const { beacon } = createBeacon();

  beacon.start();

  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });
  expect(beacon.diagnostics.get()).toMatchObject({
    status: "running",
    session: 1,
  });
});

test("LIFE-03 starting again while open answers the same stop and opens nothing more", () => {
  const web = vi.fn(() => {
    throw new Error("unused");
  });

  const { beacon } = createBeacon({
    running: { boot: { id: "boot-1" }, web },
  });

  const first = beacon.start();
  const second = beacon.start();

  expect(second).toBe(first);
  expect(web).toHaveBeenCalledTimes(1);
  expect(beacon.status.get()).toEqual({ state: "running", session: 1 });
});

test("stopping ends the session and starting again opens a new numbered one", () => {
  const { beacon } = createBeacon();
  const statuses: string[] = [];

  beacon.status.subscribe(() => statuses.push(beacon.status.get().state));

  beacon.start();
  beacon.stop();
  beacon.stop();
  beacon.start();

  expect(statuses).toEqual(["running", "stopped", "running"]);
  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("LIFE-02 the stop of an old session cannot stop a newer one", () => {
  const { beacon } = createBeacon();
  const oldStop = beacon.start();

  oldStop();
  beacon.start();
  oldStop();

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("disposing is terminal, idempotent and leaves the last snapshots readable", () => {
  const { beacon } = createBeacon();
  const listener = vi.fn();

  beacon.start();
  beacon.status.subscribe(listener);
  beacon.dispose();
  beacon.dispose();

  expect(beacon.status.get()).toEqual({ state: "disposed" });
  expect(beacon.running.get().revision).toBe(0);
  expect(listener.mock.calls).toHaveLength(2);
  expect(() => beacon.start()).toThrow(
    expect.objectContaining({ code: "DISPOSED" }),
  );

  const unsubscribe = beacon.status.subscribe(listener);

  unsubscribe();
  expect(listener.mock.calls).toHaveLength(2);
});

test("disposing leaves every last snapshot as it was, whatever the application still calls", async () => {
  const memory = createMockJournalStorage();

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage: memory },
  });

  const web = context.beacon.route("web");

  await startWithOffer(context);
  context.beacon.reportReady();
  await settle();
  context.beacon.dispose();

  const snapshots = [
    context.beacon.status.get(),
    context.beacon.running.get(),
    context.beacon.support.get(),
    context.beacon.transitions.get(),
    context.beacon.diagnostics.get(),
    web.state.get(),
  ];

  expect(() => context.beacon.reportReady({ checkpoint: "later" })).toThrow(
    expect.objectContaining({ code: "DISPOSED" }),
  );
  await context.beacon.clearJournal();
  await web.check();
  web.acknowledge();
  await settle();

  expect([
    context.beacon.status.get(),
    context.beacon.running.get(),
    context.beacon.support.get(),
    context.beacon.transitions.get(),
    context.beacon.diagnostics.get(),
    web.state.get(),
  ]).toEqual(snapshots);
  expect(context.beacon.transitions.get()).toBe(snapshots[3]);
});

test("LIFE-06 a status listener that disposes leaves the later listeners one call, with the final status", () => {
  const { beacon } = createBeacon();
  const seen: string[] = [];

  beacon.status.subscribe(() => beacon.dispose());
  beacon.status.subscribe(() => seen.push(beacon.status.get().state));
  beacon.start();

  expect(seen).toEqual(["disposed"]);
  expect(beacon.status.get()).toEqual({ state: "disposed" });
});

test("a status listener that stops the session during start leaves nothing open", () => {
  const web = vi.fn(() => buildWebRelease("web-build-a"));
  const { beacon } = createBeacon({ running: { boot: { id: "b" }, web } });

  beacon.status.subscribe(() => beacon.stop());
  beacon.start();

  expect(web).not.toHaveBeenCalled();
  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a diagnostics listener that stops the session while it starts leaves it stopped, and every listener hears the events in order", () => {
  const { beacon } = createBeacon();
  const heard: string[] = [];
  const statuses: string[] = [];

  beacon.status.subscribe(() => statuses.push(beacon.status.get().state));
  beacon.diagnostics.events.subscribe((event) => {
    if (event.type !== "session-started") {
      return;
    }

    beacon.stop();
  });
  beacon.diagnostics.events.subscribe((event) => heard.push(event.type));
  beacon.start();

  expect(heard).toEqual(["session-started", "session-stopped"]);
  expect(statuses).toEqual(["stopped"]);
  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a provider that starts the next session while its route is released leaves that session running", () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });

  let restart = () => {};

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "restarting",
      open: () => ({ native: {}, dispose: () => restart() }),
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon({ web });

  restart = () => {
    restart = () => {};

    beacon.start();
  };

  beacon.start();
  beacon.stop();

  expect(beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("a reader that ends the session while it is asked leaves the later readers, the routes and the journal alone", async () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const memory = createMockJournalStorage();
  const opens = vi.fn(() => ({ native: {} }));
  const later = vi.fn(() => buildWebRelease("web-build-b"));

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "counting",
      open: opens,
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        native: () => {
          beacon.stop();

          return buildWebRelease("native-build");
        },
        web: later,
      },
      journal: { mode: "best-effort", storage: memory },
    },
  );

  beacon.start();
  await settle();

  expect(opens).not.toHaveBeenCalled();
  expect(later).not.toHaveBeenCalled();
  expect(memory.reads()).toBe(0);
  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

test("a provider that ends the session while its route opens leaves the journal alone", async () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const memory = createMockJournalStorage();

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "stopping",
      open: () => {
        beacon.stop();

        return { native: {} };
      },
      commands: {},
    }),
  });

  const { beacon } = createRoutedBeacon(
    { web },
    { journal: { mode: "best-effort", storage: memory } },
  );

  beacon.start();
  await settle();

  expect(memory.reads()).toBe(0);
  expect(beacon.status.get()).toEqual({ state: "stopped" });
});

const STAGING: ReleaseScope = { ...SCOPE, environment: "staging" };
const TESTING: ReleaseScope = { ...SCOPE, environment: "testing" };

test("a listener that disposes the Beacon while the scope is replaced ends the replacement, and the last snapshots stay", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  await startWithOffer(context);

  let held = web.state.get();

  context.beacon.status.subscribe(() => {
    if (context.beacon.status.get().state !== "stopped") {
      return;
    }

    held = web.state.get();
    context.beacon.dispose();
  });

  expect(context.beacon.replaceScope(STAGING)).toEqual({ status: "replaced" });
  expect(context.beacon.status.get()).toEqual({ state: "disposed" });
  expect(web.state.get()).toBe(held);
});

test("a check that a listener makes while the scope is being forgotten, and the old session still open, is superseded and starts no read", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  await startWithOffer(context);

  const outcomes: Array<Promise<unknown>> = [];

  web.state.subscribe(() => {
    outcomes.push(web.check());
  });

  expect(context.beacon.replaceScope(STAGING)).toEqual({ status: "replaced" });
  await settle();

  await expect(Promise.all(outcomes)).resolves.toEqual([
    { status: "superseded" },
  ]);
  expect(context.mock.stats().reads).toBe(1);
  expect(web.state.get()).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown" },
  });
  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("a listener that starts the session again while the scope is replaced leaves one session, reading the record of the next scope", async () => {
  const memory = createMockJournalStorage();

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage: memory },
  });

  context.beacon.start();
  await settle();

  let restarts = 0;

  context.beacon.status.subscribe(() => {
    if (context.beacon.status.get().state !== "stopped" || restarts > 0) {
      return;
    }

    restarts += 1;
    context.beacon.start();
  });
  context.beacon.replaceScope(STAGING);
  await settle();

  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
  expect(context.beacon.transitions.get().journal).toBe("ready");
  expect(memory.reads()).toBe(2);
});

test("a scope that a listener puts in force while another is being replaced is the one that stays", async () => {
  const context = createWebCommandBeacon();

  context.beacon.start();

  let nested = false;

  context.beacon.status.subscribe(() => {
    if (context.beacon.status.get().state !== "stopped" || nested) {
      return;
    }

    nested = true;
    context.beacon.replaceScope(TESTING);
  });
  context.beacon.replaceScope(STAGING);

  const checking = context.beacon.route("web").check();

  await settle();

  expect(context.mock.contexts().map(({ scope }) => scope.environment)).toEqual(
    ["testing"],
  );
  expect(context.beacon.replaceScope(TESTING)).toEqual({ status: "unchanged" });
  context.beacon.stop();
  await checking;
});

const NOT_STARTED = {
  status: "failed",
  attempt: 0,
  error: {
    code: "NOT_STARTED",
    message: "An operation needs a started Beacon.",
  },
};

test("a check before the session opens settles every route and the policy as not started, and asks nothing", async () => {
  const { beacon, mock } = createPolicyBeacon();

  await expect(beacon.check()).resolves.toEqual({
    routes: { web: NOT_STARTED, binary: NOT_STARTED },
    support: NOT_STARTED,
  });
  expect(mock.stats().reads).toBe(0);
});

test("a check after the Beacon was disposed settles as disposed, and a Beacon without a policy has no support outcome", async () => {
  const { beacon } = createPolicyBeacon();
  const { beacon: plain } = createBeacon();

  beacon.dispose();

  const disposed = {
    status: "failed",
    attempt: 0,
    error: { code: "DISPOSED", message: expect.any(String) },
  };

  await expect(beacon.check()).resolves.toEqual({
    routes: { web: disposed, binary: disposed },
    support: disposed,
  });
  await expect(plain.check()).resolves.toEqual({
    routes: {},
    support: null,
  });
});

test("a caller that stops waiting for a running reader cancels every route and the policy, and asks nothing", async () => {
  const { beacon, mock } = createPolicyBeacon({ holdNative: true });
  const controller = new AbortController();

  beacon.start();

  const checking = beacon.check({ signal: controller.signal });

  await settle();
  controller.abort();

  await expect(checking).resolves.toEqual({
    routes: {
      web: { status: "cancelled" },
      binary: { status: "cancelled" },
    },
    support: { status: "cancelled" },
  });
  expect(mock.stats().reads).toBe(0);
});

test("a session that ends while a check waits for a running reader supersedes every route and the policy", async () => {
  const { beacon, mock } = createPolicyBeacon({ holdNative: true });

  beacon.start();

  const checking = beacon.check();

  beacon.stop();

  await expect(checking).resolves.toEqual({
    routes: {
      web: { status: "superseded" },
      binary: { status: "superseded" },
    },
    support: { status: "superseded" },
  });
  expect(mock.stats().reads).toBe(0);
});

test("the hydration of a journal whose storage fails on every call, beside readers that fail, leaves no unhandled rejection", async () => {
  const unhandled = vi.fn();

  process.on("unhandledRejection", unhandled);

  try {
    const unreadable = createMockJournalStorage();
    const unwritable = createMockJournalStorage();

    unreadable.failReads(new Error("The storage is offline."));
    seed(unwritable, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
    unwritable.failWrites(new Error("The storage is full."));

    for (const memory of [unreadable, unwritable]) {
      const { beacon } = createBeacon({
        journal: { mode: "best-effort", storage: memory },
        running: {
          boot: { id: "boot-1" },
          web: () => Promise.reject(new Error("The build is unknown.")),
        },
      });

      beacon.start();
      await settle();

      expect(beacon.transitions.get().journal).toBe("degraded");
    }

    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    process.off("unhandledRejection", unhandled);
  }
});
