import { afterEach, expect, test, vi } from "vitest";

import { settle } from "src/utils/Beacon.fixture";
import {
  ACCEPTED_RELOAD,
  answerWithBuild,
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";
import { COUNTED_EVENTS } from "src/utils/constants/diagnostics";
import { createDriverBeacon } from "src/utils/drivers.fixture";
import { parseJournal } from "src/utils/internal/journal/parseJournal";
import { target } from "src/utils/routes.fixture";

afterEach(() => {
  vi.useRealTimers();
});

test("SEC-01 names that live on every object are not routes", () => {
  const { beacon } = createWebCommandBeacon();

  for (const name of [
    "constructor",
    "__proto__",
    "toString",
    "hasOwnProperty",
  ]) {
    expect(() => Reflect.apply(beacon.route, beacon, [name])).toThrow(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }
});

test("SEC-01 a persisted record with prototype-sensitive keys changes no prototype and reads no such field", () => {
  const text =
    '{"version":1,"transitions":[],"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}';

  expect(parseJournal(text)).toEqual([]);
  expect(Reflect.get({}, "polluted")).toBeUndefined();
});

test("SEC-02 a document that names a command, an expression or a script URL changes no command", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");
  const capabilities = Object.keys(web.capabilities);

  context.beacon.start();

  const checking = web.check();

  await settle();

  const hostile = {
    web: target("web-build-a"),
    policy: { minimum: "1.0.0" },
    commands: { requestReload: { handler: "javascript:alert(1)" } },
    run: "() => fetch('https://attacker.example')",
  };

  context.mock.resolve({ document: hostile, expiresAt: 601_000 });
  await checking;

  expect(Object.keys(web.capabilities)).toEqual(capabilities);
  expect(web.state.get().observation).toMatchObject({ status: "available" });
  expect(context.runs).toHaveLength(0);
});

test("SEC-03 an answer that is already expired on arrival is expired evidence, and a command refuses it", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  context.beacon.start();

  const checking = web.check();

  await settle();
  answerWithBuild(context.mock, "web-build-a", "208");
  await checking;
  context.clock.advance(1_000_000);

  const { observation } = web.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  expect(observation.evidence.freshness).toBe("expired");
  await expect(
    web.requestReload({ offer: observation.offer.ref }),
  ).resolves.toEqual({
    status: "stale",
    reason: "expired",
  });
  expect(context.runs).toHaveLength(0);
});

test("SEC-04 a revision high-water mark is not persisted, so a restart claims no anti-replay protection", async () => {
  const first = createWebCommandBeacon();

  first.beacon.start();

  const checking = first.beacon.route("web").check();

  await settle();
  answerWithBuild(first.mock, "web-build-a", "208");
  await checking;

  const restarted = createWebCommandBeacon();

  restarted.beacon.start();

  const rechecking = restarted.beacon.route("web").check();

  await settle();
  answerWithBuild(restarted.mock, "web-build-z", "100");

  await expect(rechecking).resolves.toMatchObject({ status: "succeeded" });
});

test("SEC-06 a diagnostics listener that throws is rethrown outside, and state and commands carry on", async () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const context = createWebCommandBeacon();
  const failure = new Error("sink down");
  const seen: string[] = [];

  context.beacon.diagnostics.events.subscribe(() => {
    throw failure;
  });
  context.beacon.diagnostics.events.subscribe((event) => {
    seen.push(event.type);
  });
  context.beacon.start();
  context.beacon.stop();

  expect(seen).toContain("session-stopped");
  expect(() => vi.runAllTicks()).toThrow(failure);
  expect(context.beacon.status.get()).toEqual({ state: "stopped" });
});

test("SEC-07 reading every route, its support and the diagnostics demands no update, no registration and no command", async () => {
  const context = createDriverBeacon();
  const web = createWebCommandBeacon();

  context.beacon.diagnostics.subscribe(() => {});
  context.beacon.diagnostics.events.subscribe(() => {});
  web.beacon.diagnostics.subscribe(() => {});

  for (const beacon of [context.beacon, web.beacon]) {
    beacon.status.get();
    beacon.running.get();
    beacon.support.get();
    beacon.transitions.get();
    beacon.diagnostics.get();
  }

  context.ota.state.get();
  context.ota.native.get();
  Object.keys(context.ota.capabilities);
  web.beacon.route("web").state.get();
  await settle();

  expect(context.counts.opens).toBe(0);
  expect(web.mock.stats().reads).toBe(0);
  expect(web.runs).toHaveLength(0);
  expect(web.beacon.status.get()).toEqual({ state: "idle" });
});

test("SEC-10 a provider handle called directly starts an action Beacon does not claim to own", async () => {
  const context = createDriverBeacon();

  context.beacon.start();
  context.native.label = "called directly";

  expect(context.ota.state.get().operation).toEqual({ state: "idle" });
  expect(context.beacon.transitions.get().latest).toBeNull();
  expect(context.downloads).toHaveLength(0);
});

test("the raw error of a failed check never reaches the published state", async () => {
  const context = createWebCommandBeacon();

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  context.mock.reject(
    new Error("https://user:secret@example.com/manifest.json returned 500"),
  );
  await checking;

  const { check } = context.beacon.route("web").state.get();

  expect(JSON.stringify(check)).not.toContain("secret");
  expect(check).toMatchObject({
    state: "failed",
    error: { code: "SOURCE_FAILED" },
  });
});

test("an accepted reload does not put its offer's build in the diagnostics event", async () => {
  const context = createWebCommandBeacon();
  const events: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(JSON.stringify(event));
  });

  const pending = context.beacon.route("web").requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await pending;

  expect(events.join("")).not.toContain("web-build-a");
});

test("SEC-08 the diagnostics keep counters and no log, so their size does not grow with the events", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  context.beacon.start();

  const sizeOf = () => JSON.stringify(context.beacon.diagnostics.get()).length;

  const check = async () => {
    const checking = web.check();

    await settle();
    answerWithBuild(context.mock, "web-build-a", "208");
    await checking;
  };

  for (let index = 0; index < 5; index += 1) {
    await check();
  }

  const before = sizeOf();

  for (let index = 0; index < 200; index += 1) {
    await check();
  }

  expect(sizeOf()).toBe(before);
});

test("SEC-09 an accepted command is never an installation in the diagnostics", async () => {
  const context = createWebCommandBeacon();
  const events: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(event.type);
  });

  const pending = context.beacon.route("web").requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await pending;

  expect(events).toEqual(["command-admitted", "command-settled"]);
  expect(Object.keys(COUNTED_EVENTS)).not.toContainEqual(
    expect.stringMatching(/install|update|complete|success/),
  );
});
