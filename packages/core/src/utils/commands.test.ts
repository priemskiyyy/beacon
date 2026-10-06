import { expect, test } from "vitest";

import { settle } from "src/utils/Beacon.fixture";
import { createMemoryStorage } from "src/utils/journal.fixture";
import {
  ACCEPTED_RELOAD,
  answerWithBuild,
  createParticipant,
  createTwoRouteCommandBeacon,
  createWebCommandBeacon,
  startWithOffer,
  startWithOffers,
  takeRun,
} from "src/utils/commands.fixture";

test("WEB-01 an accepted reload proves only the request, and the running build stays", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(reload).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "reload-requested" },
  });
  expect(context.beacon.running.get().web).toMatchObject({
    state: "known",
    release: { label: "Build web-build-b" },
  });
});

test("WEB-01 the realm is expected to end, so the operation stays unresolved until acknowledged", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  context.beacon.disruptions.register(createParticipant("drafts", log));

  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reload;

  expect(web.state.get().operation).toEqual({
    state: "indeterminate",
    operation: { id: 1 },
    command: "requestReload",
    reason: "dispatch-unconfirmed",
  });
  expect(log).toEqual(["drafts:reserve", "drafts:settle"]);

  web.acknowledge();

  expect(log).toEqual(["drafts:reserve", "drafts:settle", "drafts:release"]);
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("a route that is unresolved refuses another command instead of replaying it", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reload;

  await expect(web.requestReload({ offer })).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "operation-indeterminate", participant: null }],
  });
  expect(context.runs).toHaveLength(0);
});

test("WEB-02 a reload that throws fails, releases the reservations and keeps the evidence", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const before = web.state.get().observation;

  context.beacon.disruptions.register(createParticipant("drafts", log));

  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).fail(new Error("navigation refused"));

  await expect(reload).resolves.toEqual({
    status: "failed",
    error: { code: "COMMAND_FAILED", message: "A command failed." },
  });
  expect(log).toEqual(["drafts:reserve", "drafts:settle", "drafts:release"]);
  expect(web.state.get().observation).toBe(before);
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("WEB-03 a reload that may have dispatched is indeterminate and is never retried blindly", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith({
    status: "indeterminate",
    reason: "navigation-unconfirmed",
  });

  await expect(reload).resolves.toEqual({
    status: "indeterminate",
    operation: { id: 1 },
    reason: "navigation-unconfirmed",
  });
  expect(web.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "navigation-unconfirmed",
  });
  await expect(web.requestReload({ offer })).resolves.toMatchObject({
    status: "blocked",
  });
  expect(context.runs).toHaveLength(0);
});

test("a provider that reports it no longer has the target settles as stale, and releases", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith({ status: "stale" });

  await expect(reload).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("a provider that cannot do it settles as unsupported, and releases", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith({
    status: "unsupported",
    reason: "no-navigation",
  });

  await expect(reload).resolves.toEqual({
    status: "unsupported",
    reason: "no-navigation",
  });
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("a provider that cancelled settles as cancelled with its stage", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith({ status: "cancelled", stage: "dialog" });

  await expect(reload).resolves.toEqual({
    status: "cancelled",
    stage: "dialog",
  });
});

test("SAFE-02 a participant reserves before any settlement begins", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(createParticipant("drafts", log));
  context.beacon.disruptions.register(createParticipant("uploads", log));

  const reload = context.beacon.route("web").requestReload({ offer });

  expect(log).toEqual([
    "drafts:reserve",
    "uploads:reserve",
    "drafts:settle",
    "uploads:settle",
  ]);

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reload;
});

test("SAFE-03 a participant that refuses releases the earlier reservations in reverse, and nothing is dispatched", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(createParticipant("drafts", log));
  context.beacon.disruptions.register(createParticipant("uploads", log));
  context.beacon.disruptions.register(
    createParticipant("session", log, {
      reserve: () => ({ status: "blocked", code: "signing-out" }),
    }),
  );

  await expect(
    context.beacon.route("web").requestReload({ offer }),
  ).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "signing-out", participant: { name: "session" } }],
  });
  expect(log).toEqual([
    "drafts:reserve",
    "uploads:reserve",
    "session:reserve",
    "uploads:release",
    "drafts:release",
  ]);
  expect(context.runs).toHaveLength(0);
});

test("SAFE-04 a draft that cannot be saved blocks the reload and nothing is dispatched", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  context.beacon.disruptions.register(
    createParticipant("drafts", log, {
      settlement: async () => ({ status: "blocked", code: "draft-not-saved" }),
    }),
  );

  await expect(web.requestReload({ offer })).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "draft-not-saved", participant: { name: "drafts" } }],
  });
  expect(log).toEqual(["drafts:reserve", "drafts:settle", "drafts:release"]);
  expect(context.runs).toHaveLength(0);
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("a participant that never settles blocks the command when its deadline passes", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(
    createParticipant("drafts", log, {
      settlement: () => new Promise(() => {}),
    }),
  );

  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  context.clock.advance(10_000);

  await expect(reload).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "settlement-timeout", participant: { name: "drafts" } }],
  });
  expect(context.runs).toHaveLength(0);
});

test("a participant that does not care about the impact is not asked", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(
    createParticipant("uploads", log, { impacts: ["native-update-flow"] }),
  );

  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reload;

  expect(log).toEqual([]);
});

test("SAFE-06 a participant registered while settling changes the safety context, and blocks", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const settling = { release: () => {} };

  context.beacon.disruptions.register(
    createParticipant("drafts", log, {
      settlement: () =>
        new Promise((resolve) => {
          settling.release = () => resolve({ status: "ready" });
        }),
    }),
  );

  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  context.beacon.disruptions.register(createParticipant("late", log));
  settling.release();

  await expect(reload).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "safety-changed", participant: null }],
  });
  expect(context.runs).toHaveLength(0);
  expect(log).toEqual(["drafts:reserve", "drafts:settle", "drafts:release"]);
});

test("an offer replaced while settling is stale, and nothing is dispatched", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const settling = { release: () => {} };

  context.beacon.disruptions.register(
    createParticipant("drafts", log, {
      settlement: () =>
        new Promise((resolve) => {
          settling.release = () => resolve({ status: "ready" });
        }),
    }),
  );

  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();

  const rechecking = context.beacon.route("web").check();

  await settle();
  answerWithBuild(context.mock, "web-build-c", "209");
  await rechecking;
  settling.release();

  await expect(reload).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
  expect(context.runs).toHaveLength(0);
  expect(log).toContain("drafts:release");
});

test("an identical call while the command runs joins it and dispatches once", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const first = web.requestReload({ offer });
  const second = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  const outcomes = await Promise.all([first, second]);

  expect(outcomes[0]).toEqual(outcomes[1]);
  expect(outcomes[0]).toMatchObject({
    status: "accepted",
    operation: { id: 1 },
  });
  expect(context.runs).toHaveLength(0);
});

test("a joined caller that aborts stops only its own wait", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const controller = new AbortController();
  const first = web.requestReload({ offer });
  const second = web.requestReload({ offer, signal: controller.signal });

  controller.abort();

  await expect(second).resolves.toEqual({
    status: "cancelled",
    stage: "joined",
  });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(first).resolves.toMatchObject({ status: "accepted" });
});

test("a different command while the route is busy is blocked, not queued", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reload = web.requestReload({ offer });

  await expect(web.prefetch()).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "operation-in-progress", participant: null }],
  });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reload;

  expect(context.warmed.count).toBe(0);
});

test("SAFE-09 a guard that repeats the call it guards joins it instead of dispatching twice", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const repeats: Array<ReturnType<typeof web.requestReload>> = [];

  context.beacon.disruptions.register({
    name: "guard",
    impacts: ["document-replacement"],
    reserve: () => {
      repeats.push(web.requestReload({ offer }));

      return { status: "reserved", release: () => {} };
    },
  });

  const reload = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  const [outer, inner] = await Promise.all([reload, ...repeats]);

  expect(inner).toEqual(outer);
  expect(context.runs).toHaveLength(0);
});

test("SAFE-10 a caller that aborts while participants settle cancels, releases, and asks no provider", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const controller = new AbortController();

  context.beacon.disruptions.register(
    createParticipant("drafts", log, {
      settlement: () => new Promise(() => {}),
    }),
  );

  const reload = web.requestReload({ offer, signal: controller.signal });

  await settle();
  controller.abort();

  await expect(reload).resolves.toEqual({
    status: "cancelled",
    stage: "settling",
  });
  expect(log).toEqual(["drafts:reserve", "drafts:settle", "drafts:release"]);
  expect(context.runs).toHaveLength(0);
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("SAFE-11 a caller that aborts after the dispatch gets indeterminate, never cancelled", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const controller = new AbortController();

  context.beacon.disruptions.register(createParticipant("drafts", log));

  const reload = web.requestReload({ offer, signal: controller.signal });

  await settle();
  controller.abort();

  await expect(reload).resolves.toEqual({
    status: "indeterminate",
    operation: { id: 1 },
    reason: "aborted-after-dispatch",
  });
  expect(web.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  expect(log).not.toContain("drafts:release");
});

test("a provider that later confirms the command failed releases what an abort left held", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const controller = new AbortController();

  context.beacon.disruptions.register(createParticipant("drafts", log));

  const reload = web.requestReload({ offer, signal: controller.signal });

  await settle();
  controller.abort();
  await reload;
  takeRun(context.runs).settleWith({ status: "cancelled", stage: "dialog" });
  await settle();

  expect(log).toContain("drafts:release");
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("SAFE-08 a disruptive command on another route is blocked while one runs, not queued", async () => {
  const context = createTwoRouteCommandBeacon();
  const offers = await startWithOffers(context);

  const first = context.beacon
    .route("first")
    .requestReload({ offer: offers.first });

  await expect(
    context.beacon.route("second").requestReload({ offer: offers.second }),
  ).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "operation-in-progress", participant: null }],
  });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await first;

  expect(context.runs).toHaveLength(0);
});

test("a route that changes nothing running is not held back by a disruptive command elsewhere", async () => {
  const context = createTwoRouteCommandBeacon();
  const offers = await startWithOffers(context);

  const first = context.beacon
    .route("first")
    .requestReload({ offer: offers.first });

  await expect(
    context.beacon.route("second").prefetch(),
  ).resolves.toMatchObject({ status: "accepted" });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await first;
});

test("acknowledging the route that holds the disruptive slot frees it for another route", async () => {
  const context = createTwoRouteCommandBeacon();
  const offers = await startWithOffers(context);

  const first = context.beacon
    .route("first")
    .requestReload({ offer: offers.first });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await first;
  context.beacon.route("first").acknowledge();

  const second = context.beacon
    .route("second")
    .requestReload({ offer: offers.second });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(second).resolves.toMatchObject({ status: "accepted" });
});

test("a command that changes nothing that is running does not take the disruptive slot", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  context.beacon.start();

  await expect(web.prefetch()).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "warmed" },
  });
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("a copy of a reference is refused as foreign", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);

  await expect(
    context.beacon.route("web").requestReload({ offer: { ...offer } }),
  ).resolves.toEqual({ status: "stale", reason: "foreign" });
  expect(context.runs).toHaveLength(0);
});

test("an offer that a later check replaced is refused as replaced", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const rechecking = web.check();

  await settle();
  answerWithBuild(context.mock, "web-build-c", "209");
  await rechecking;

  await expect(web.requestReload({ offer })).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
});

test("an offer whose evidence lapsed is refused as expired", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);

  context.clock.advance(600_000);

  await expect(
    context.beacon.route("web").requestReload({ offer }),
  ).resolves.toEqual({ status: "stale", reason: "expired" });
});

test("a command before start fails as not started", async () => {
  const context = createWebCommandBeacon();

  await expect(context.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "failed",
    error: { code: "NOT_STARTED" },
  });
});

test("a command after dispose fails as disposed", async () => {
  const context = createWebCommandBeacon();

  context.beacon.dispose();

  await expect(context.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DISPOSED" },
  });
});

test("stopping the session while participants settle cancels the command", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(
    createParticipant("drafts", log, {
      settlement: () => new Promise(() => {}),
    }),
  );

  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  context.beacon.stop();

  await expect(reload).resolves.toEqual({
    status: "cancelled",
    stage: "settling",
  });
  expect(log).toContain("drafts:release");
});

test("stopping the session after the dispatch leaves the operation unresolved for the next session", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reload = web.requestReload({ offer });

  await settle();
  context.beacon.stop();

  await expect(reload).resolves.toMatchObject({ status: "indeterminate" });

  context.beacon.start();

  expect(web.state.get().operation.state).toBe("indeterminate");

  web.acknowledge();

  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("disposing releases the reservations a command still holds", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(createParticipant("drafts", log));

  const reload = context.beacon.route("web").requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reload;

  expect(log).toEqual(["drafts:reserve", "drafts:settle"]);

  context.beacon.dispose();

  expect(log).toEqual(["drafts:reserve", "drafts:settle", "drafts:release"]);
});

test("acknowledge on a route with nothing unresolved changes nothing", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");
  const before = web.state.get();

  web.acknowledge();

  expect(web.state.get()).toBe(before);
});

test("diagnostics record the admission and the settlement of a command", async () => {
  const context = createWebCommandBeacon();
  const events: string[] = [];

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.command}:${event.reason}`);
  });
  context.beacon.start();

  await context.beacon.route("web").prefetch();

  expect(events).toContain("command-admitted:prefetch:null");
  expect(events).toContain("command-settled:prefetch:accepted");
});

test("SAFE-06 the provider is never asked once the caller has given up, however the abort interleaves with the intent's write", async () => {
  for (const hops of [0, 1, 2, 3, 4, 5, 6, 8]) {
    const memory = createMemoryStorage();
    const controller = new AbortController();

    const context = createWebCommandBeacon({
      journal: { mode: "best-effort", storage: memory.storage },
    });

    const offer = await startWithOffer(context);
    const write = memory.storage.write;

    memory.storage.write = async (key, value) => {
      await write(key, value);

      // The abort lands a number of microtask turns after the write resolves.
      let turn = Promise.resolve();

      for (let hop = 0; hop < hops; hop += 1) {
        turn = turn.then(() => {});
      }

      turn.then(() => controller.abort());
    };

    const reloading = context.beacon
      .route("web")
      .requestReload({ offer, signal: controller.signal });

    await settle();

    for (const run of context.runs) {
      expect(run.abortedOnArrival).toBe(false);
      run.settleWith(ACCEPTED_RELOAD);
    }

    await reloading;
  }
});

test("SAFE-10 a caller that gave up before the call disrupts nobody", async () => {
  const context = createWebCommandBeacon();
  const log: string[] = [];
  const offer = await startWithOffer(context);
  const controller = new AbortController();

  context.beacon.disruptions.register(createParticipant("drafts", log));
  controller.abort();

  await expect(
    context.beacon
      .route("web")
      .requestReload({ offer, signal: controller.signal }),
  ).resolves.toMatchObject({ status: "cancelled" });
  expect(log).toEqual([]);
  expect(context.runs).toHaveLength(0);
});

test("SAFE-04 a participant whose settlement throws at once blocks the command by name", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register({
    name: "drafts",
    impacts: ["document-replacement"],
    reserve: () => ({
      status: "reserved",
      settle: () => {
        throw new Error("The draft store is gone.");
      },
      release: () => {},
    }),
  });

  await expect(
    context.beacon.route("web").requestReload({ offer }),
  ).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "settlement-failed", participant: { name: "drafts" } }],
  });
  expect(context.runs).toHaveLength(0);
});

test("SEC-03 an offer whose expiry the clock has passed is refused as expired even when no timer has run", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);

  context.clock.skip(700_000);

  await expect(
    context.beacon.route("web").requestReload({ offer }),
  ).resolves.toEqual({ status: "stale", reason: "expired" });
  expect(context.runs).toHaveLength(0);
});
