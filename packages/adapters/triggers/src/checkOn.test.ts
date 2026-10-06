import { Beacon } from "@priemskiyyy/beacon";
import { createTestClock, settle } from "@priemskiyyy/beacon/mock";
import { afterEach, expect, test, vi } from "vitest";

import { checkOn } from "src/checkOn";
import {
  countRouteSubscriptions,
  createTestBeacon,
  deploy,
  SCOPE,
} from "src/checkOn.fixture";
import {
  fakeAppState,
  fakeChannel,
  fakeNetInfo,
} from "src/fakeSources.fixture";
import { foreground } from "src/foreground";
import { interval } from "src/interval";
import { invalidation } from "src/invalidation";
import { reconnect } from "src/reconnect";
import type { BeaconTrigger } from "src/types/BeaconTrigger";

afterEach(() => {
  vi.useRealTimers();
});

// A React Native app's sources, over fakes that count their listeners, and every trigger made from them.
const create = () => {
  const context = createTestBeacon();
  const app = fakeAppState();
  const network = fakeNetInfo();
  const channel = fakeChannel();

  return {
    ...context,
    app,
    network,
    channel,
    triggers: [
      foreground({ appState: app.appState }),
      reconnect({ netInfo: network.netInfo }),
      invalidation({ source: channel.source }),
      interval({ every: 60_000 }),
    ],
    listeners: () => ({
      app: app.listeners(),
      network: network.listeners(),
      channel: channel.listeners(),
    }),
  };
};

const leave = (app: ReturnType<typeof fakeAppState>) => {
  app.emit("background");
  app.emit("active");
};

test("TRIG-01 nothing is subscribed or armed before checkOn, nor before the session opens", async () => {
  const { beacon, mock, clock, triggers, listeners } = create();

  mock.answer({ document: deploy("update-2") });
  beacon.start();
  await settle();

  expect(listeners()).toEqual({ app: 0, network: 0, channel: 0 });
  expect(clock.pendingTimers()).toBe(0);

  beacon.stop();

  const stop = checkOn(beacon, { triggers });

  await settle();

  expect(listeners()).toEqual({ app: 0, network: 0, channel: 0 });
  expect(clock.pendingTimers()).toBe(0);
  expect(mock.stats().reads).toBe(0);

  beacon.start();
  await settle();

  expect(listeners()).toEqual({ app: 1, network: 1, channel: 1 });
  expect(mock.stats().reads).toBe(1);

  stop();
});

test("TRIG-02 stopping leaves no listener and no timer, and a signal after it checks nothing", async () => {
  const { beacon, mock, clock, app, network, channel, triggers, listeners } =
    create();

  mock.answer({ document: deploy("update-2") });
  beacon.start();

  const stop = checkOn(beacon, { triggers });

  await settle();

  expect(listeners()).toEqual({ app: 1, network: 1, channel: 1 });
  expect(clock.pendingTimers()).toBeGreaterThan(0);

  stop();

  expect(listeners()).toEqual({ app: 0, network: 0, channel: 0 });
  expect(clock.pendingTimers()).toBe(0);

  leave(app);
  network.emit(false);
  network.emit(true);
  channel.push();
  clock.advance(60 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(1);

  stop();

  expect(listeners()).toEqual({ app: 0, network: 0, channel: 0 });
});

test("TRIG-03 an effect that runs twice, as in Strict Mode, leaves one set of listeners", async () => {
  const { beacon, mock, triggers, listeners } = create();

  mock.answer({ document: deploy("update-2") });

  const stopFirst = checkOn(beacon, { triggers });

  stopFirst();

  const stopSecond = checkOn(beacon, { triggers });

  beacon.start();
  await settle();

  expect(listeners()).toEqual({ app: 1, network: 1, channel: 1 });
  expect(mock.stats().reads).toBe(1);

  stopSecond();

  expect(listeners()).toEqual({ app: 0, network: 0, channel: 0 });
});

test("TRIG-04 the triggers follow the session: its end takes them back, and the next start installs them and checks again", async () => {
  const { beacon, mock, clock, triggers, listeners, reasons } = create();

  mock.answer({ document: deploy("update-2") });
  beacon.start();

  const stop = checkOn(beacon, { triggers });

  await settle();
  beacon.stop();

  expect(listeners()).toEqual({ app: 0, network: 0, channel: 0 });
  expect(clock.pendingTimers()).toBe(0);

  beacon.start();
  await settle();

  expect(listeners()).toEqual({ app: 1, network: 1, channel: 1 });
  expect(reasons()).toEqual(["startup", "startup"]);

  stop();
});

test("TRIG-04 a session that opens checks at startup whatever its triggers are, and startup false leaves the first check to them", async () => {
  const first = createTestBeacon();
  const second = createTestBeacon();

  first.mock.answer({ document: deploy("update-2") });
  second.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(first.beacon, { triggers: [] });
  const stopQuiet = checkOn(second.beacon, { triggers: [], startup: false });

  first.beacon.start();
  second.beacon.start();
  await settle();

  expect(first.reasons()).toEqual(["startup"]);
  expect(second.reasons()).toEqual([]);
  expect(second.mock.stats().reads).toBe(0);

  stop();
  stopQuiet();
});

test("TRIG-05 a new scope starts the triggers again with nothing carried over: no listener leaks, startup checks, and the wait after a failure is forgotten", async () => {
  const { beacon, mock, triggers, listeners } = create();

  checkOn(beacon, {
    triggers,
    backoff: { first: 60_000, max: 60_000, jitter: 0, attempts: 0 },
  });
  beacon.start();
  await settle();
  mock.reject(new Error("503"));
  await settle();

  expect(mock.stats().reads).toBe(1);

  const replacement = beacon.replaceScope({ ...SCOPE, environment: "staging" });

  await settle();

  expect(replacement.status).toBe("replaced");
  expect(listeners()).toEqual({ app: 1, network: 1, channel: 1 });
  // The new scope is a new authority, so its first check does not wait out the old one's failure.
  expect(mock.stats().reads).toBe(2);
});

test("TRIG-06 a trigger that throws on install costs only itself, and its error reaches the host outside the call", async () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const { beacon, mock, app } = create();

  const broken: BeaconTrigger = () => {
    throw new Error("broken trigger");
  };

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    triggers: [broken, foreground({ appState: app.appState })],
    minInterval: 1,
  });
  beacon.start();

  expect(() => vi.runAllTicks()).toThrow("broken trigger");
  expect(app.listeners()).toBe(1);

  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-07 a cleanup that throws costs only itself, and its error reaches the host outside the call", () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const { beacon, app } = create();

  const broken: BeaconTrigger = () => () => {
    throw new Error("broken cleanup");
  };

  const stop = checkOn(beacon, {
    triggers: [foreground({ appState: app.appState }), broken],
  });

  beacon.start();
  stop();

  expect(() => vi.runAllTicks()).toThrow("broken cleanup");
  expect(app.listeners()).toBe(0);
});

test("TRIG-08 a trigger that keeps its signal after the session ended still starts no check", async () => {
  const { beacon, mock } = create();

  const leaked: { signal: ((reason: "manual") => void) | null } = {
    signal: null,
  };

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    triggers: [
      (target) => {
        leaked.signal = target.signal;

        return () => {};
      },
    ],
  });
  beacon.start();
  beacon.stop();
  leaked.signal?.("manual");
  await settle();

  expect(mock.stats().reads).toBe(0);
});

test("TRIG-09 signals of one moment cost one read, and count as one failure if it fails", async () => {
  const { beacon, mock, clock, app, channel, triggers, reasons } = create();

  checkOn(beacon, {
    triggers,
    minInterval: 1,
    backoff: { first: 10_000, max: 100_000, jitter: 0 },
  });
  beacon.start();
  await settle();
  clock.advance(1);

  expect(mock.stats().reads).toBe(1);

  leave(app);
  channel.push();
  await settle();

  expect(mock.stats().reads).toBe(1);
  expect(reasons()).toEqual(["startup"]);

  // The read they shared failed once: one wait of 10,000, not one for each signal.
  mock.reject(new Error("503"));
  await settle();
  clock.advance(9_999);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-10 a reconnect during a read that began before it gets a read that begins after it, and a flapping network cannot start reads faster than the minimum interval", async () => {
  const { beacon, mock, clock, network } = create();

  checkOn(beacon, {
    triggers: [reconnect({ netInfo: network.netInfo })],
  });
  beacon.start();
  await settle();

  expect(mock.stats().reads).toBe(1);

  network.emit(false);
  clock.advance(2_000);
  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(3_000);
  await settle();

  // The core holds the trailing read until the one in flight ends.
  expect(mock.stats().reads).toBe(1);

  mock.reject(new Error("the network was down when this began"));
  await settle();

  expect(mock.stats().reads).toBe(2);
  expect(mock.stats().held).toBe(1);
});

test("TRIG-11 signals inside the minimum interval become one later start", async () => {
  const { beacon, mock, clock, app } = create();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    triggers: [foreground({ appState: app.appState })],
  });
  beacon.start();
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1_000);
  leave(app);
  clock.advance(1_000);
  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(3_000);
  await settle();

  expect(mock.stats().reads).toBe(2);

  clock.advance(60 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-12 a failed check backs off, retries by itself as often as attempts allow, and a success starts the count again", async () => {
  const { beacon, mock, clock, app, reasons } = create();

  checkOn(beacon, {
    triggers: [foreground({ appState: app.appState })],
    minInterval: 1_000,
    backoff: { first: 10_000, max: 40_000, jitter: 0, attempts: 1 },
  });
  beacon.start();
  await settle();
  mock.reject(new Error("503"));
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(2_000);
  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(8_000);
  await settle();

  // The signal that waited and the retry are one start.
  expect(mock.stats().reads).toBe(2);
  expect(reasons()).toEqual(["startup", "foreground"]);

  mock.reject(new Error("503"));
  await settle();
  clock.advance(19_999);
  await settle();

  expect(mock.stats().reads).toBe(2);

  clock.advance(60 * 60_000);
  await settle();

  // One retry was all it was allowed, so it waits for the next signal.
  expect(mock.stats().reads).toBe(2);

  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(3);

  mock.resolve({ document: deploy("update-2") });
  await settle();
  clock.advance(1_000);
  leave(app);
  await settle();
  mock.reject(new Error("503"));
  await settle();
  clock.advance(10_000);
  await settle();

  expect(mock.stats().reads).toBe(5);
  expect(reasons().slice(-2)).toEqual(["foreground", "interval"]);
});

test("TRIG-13 a wait after a failure doubles with each one, with the default jitter and three retries", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  checkOn(beacon, {
    triggers: [],
    minInterval: 1,
    backoff: { first: 10_000, max: 100_000 },
    random: () => 0.5,
  });
  beacon.start();
  await settle();

  // 10,000 and a fifth of it at half: 11,000.
  mock.reject(new Error("503"));
  await settle();
  clock.advance(10_999);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(2);

  // 20,000 and 2,000.
  mock.reject(new Error("503"));
  await settle();
  clock.advance(21_999);
  await settle();

  expect(mock.stats().reads).toBe(2);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(3);

  // 40,000 and 4,000.
  mock.reject(new Error("503"));
  await settle();
  clock.advance(43_999);
  await settle();

  expect(mock.stats().reads).toBe(3);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(4);

  mock.reject(new Error("503"));
  await settle();
  clock.advance(60 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(4);
});

test("TRIG-13 a wait never goes past its maximum, the jitter included", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  checkOn(beacon, {
    triggers: [],
    minInterval: 1,
    backoff: { first: 10_000, max: 25_000, attempts: 4 },
    random: () => 0.5,
  });
  beacon.start();
  await settle();

  for (const wait of [11_000, 22_000]) {
    mock.reject(new Error("503"));
    await settle();
    clock.advance(wait);
    await settle();
  }

  expect(mock.stats().reads).toBe(3);

  // 40,000 is over the maximum, and so is 25,000 and a tenth of it.
  mock.reject(new Error("503"));
  await settle();
  clock.advance(24_999);
  await settle();

  expect(mock.stats().reads).toBe(3);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(4);

  mock.reject(new Error("503"));
  await settle();
  clock.advance(24_999);
  await settle();

  expect(mock.stats().reads).toBe(4);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(5);
});

test("TRIG-14 a reconnect does not wait out a backoff, and a return does, and the check of the reconnect answers the return that waited", async () => {
  const { beacon, mock, clock, app, network } = create();

  checkOn(beacon, {
    triggers: [
      foreground({ appState: app.appState }),
      reconnect({ netInfo: network.netInfo }),
    ],
    minInterval: 1_000,
    backoff: { first: 60_000, max: 60_000, jitter: 0, attempts: 0 },
  });
  beacon.start();
  await settle();
  mock.reject(new Error("offline"));
  await settle();
  clock.advance(2_000);
  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(1);

  network.emit(false);
  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(2);

  mock.resolve({ document: deploy("update-2") });
  await settle();
  clock.advance(60 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-15 a read that fails after checkOn was stopped costs no wait and no retry, and nor does one under a session that ended", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  const stop = checkOn(beacon, {
    triggers: [],
    backoff: { first: 10_000, max: 10_000 },
  });

  beacon.start();
  await settle();
  stop();
  mock.reject(new Error("503"));
  await settle();

  expect(clock.pendingTimers()).toBe(0);

  clock.advance(60 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(1);

  checkOn(beacon, {
    triggers: [],
    backoff: { first: 10_000, max: 10_000 },
  });
  await settle();

  expect(mock.stats().reads).toBe(2);

  beacon.stop();
  mock.reject(new Error("503"));
  await settle();

  // The late answer of a session that ended is superseded, and counts as nothing.
  expect(clock.pendingTimers()).toBe(0);

  beacon.start();
  await settle();

  expect(mock.stats().reads).toBe(3);
});

test("TRIG-15 a wait that was armed before checkOn was stopped goes with it", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  const stop = checkOn(beacon, {
    triggers: [],
    backoff: { first: 10_000, max: 10_000 },
  });

  beacon.start();
  await settle();
  mock.reject(new Error("503"));
  await settle();

  expect(clock.pendingTimers()).toBeGreaterThan(0);

  stop();

  expect(clock.pendingTimers()).toBe(0);

  clock.advance(60 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-16 while every route holds fresh evidence that can expire, a return is skipped, and a reconnect, a push and a startup are not", async () => {
  const { beacon, mock, clock, app, network, channel, reasons } = create();

  mock.answer({
    document: deploy("update-2"),
    expiresAt: clock.now() + 600_000,
  });
  checkOn(beacon, {
    triggers: [
      foreground({ appState: app.appState }),
      reconnect({ netInfo: network.netInfo }),
      invalidation({ source: channel.source }),
    ],
    whileFresh: "skip",
    minInterval: 1,
  });
  beacon.start();
  await settle();

  clock.advance(60_000);
  leave(app);
  await settle();

  expect(reasons()).toEqual(["startup"]);

  network.emit(false);
  network.emit(true);
  await settle();
  clock.advance(1);
  channel.push();
  await settle();

  expect(reasons()).toEqual(["startup", "reconnect", "invalidation"]);

  // The core flips the evidence to expired at the authority's own time.
  clock.advance(540_000);
  leave(app);
  await settle();

  expect(reasons().at(-1)).toBe("foreground");
});

test("TRIG-16 evidence that never expires is not fresh enough to skip a return", async () => {
  const { beacon, mock, clock, app } = create();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    triggers: [foreground({ appState: app.appState })],
    whileFresh: "skip",
    minInterval: 1,
  });
  beacon.start();
  await settle();
  clock.advance(1);
  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-17 a Beacon without routes has no fresh evidence, so a return still checks", async () => {
  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: {},
    clock: createTestClock(),
  });

  const check = vi.spyOn(beacon, "check");
  const app = fakeAppState();

  checkOn(beacon, {
    triggers: [foreground({ appState: app.appState })],
    whileFresh: "skip",
  });
  beacon.start();
  leave(app);

  expect(check).toHaveBeenCalledTimes(1);
});

test("TRIG-18 a check starts when the authority's own expiresAt passes, without a timer of the gate's own", async () => {
  const { beacon, mock, clock, reasons } = create();

  mock.answer({
    document: deploy("update-2"),
    expiresAt: clock.now() + 600_000,
  });
  checkOn(beacon, { triggers: [], onExpiry: true, minInterval: 1 });
  beacon.start();
  await settle();
  clock.advance(1);

  expect(mock.stats().reads).toBe(1);
  // The only timer is the core's expiry timer: the gate armed none for it.
  expect(clock.pendingTimers()).toBe(1);

  clock.advance(598_999);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1_000);
  await settle();

  expect(mock.stats().reads).toBe(2);
  expect(reasons()).toEqual(["startup", "interval"]);
});

test("TRIG-18 an expiry that nothing renewed does not start a check for every change after it", async () => {
  const { beacon, mock, clock, reasons } = createTestBeacon();

  mock.answer({
    document: deploy("update-2"),
    expiresAt: clock.now() + 600_000,
  });
  checkOn(beacon, { triggers: [], onExpiry: true, minInterval: 1 });
  beacon.start();
  await settle();
  mock.hold();
  clock.advance(600_000);
  await settle();

  expect(reasons()).toEqual(["startup", "interval"]);

  // The check that the expiry started fails, and the evidence is still the expired one.
  mock.reject(new Error("503"));
  await settle();
  clock.advance(1);

  // A check of the application's own changes the route's state, which is not a new expiry.
  const manual = beacon.check({ reason: "manual" });

  await settle();
  mock.reject(new Error("503"));
  await manual;

  expect(reasons()).toEqual(["startup", "interval", "manual"]);
});

test("TRIG-18 stopping takes the expiry listener back with the rest", async () => {
  const { beacon, mock, clock } = createTestBeacon();
  const subscriptions = countRouteSubscriptions(beacon);

  mock.answer({
    document: deploy("update-2"),
    expiresAt: clock.now() + 600_000,
  });

  const stop = checkOn(beacon, {
    triggers: [],
    onExpiry: true,
    minInterval: 1,
  });

  beacon.start();
  await settle();

  expect(subscriptions()).toBe(1);

  stop();

  expect(subscriptions()).toBe(0);

  clock.advance(600_000);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-19 every trigger checks for its own reason", async () => {
  const { beacon, mock, clock, app, network, channel, triggers, reasons } =
    create();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, { triggers, minInterval: 1 });
  beacon.start();
  await settle();
  clock.advance(1);
  leave(app);
  await settle();
  clock.advance(1);
  network.emit(false);
  network.emit(true);
  await settle();
  clock.advance(1);
  channel.push();
  await settle();
  clock.advance(60_000);
  await settle();

  expect(reasons()).toEqual([
    "startup",
    "foreground",
    "reconnect",
    "invalidation",
    "interval",
  ]);
});

test("TRIG-30 a clock that cannot arm a timer costs the wait it would have made, and its error reaches the host outside the call", async () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const state = { canArm: true };
  const { beacon, mock } = createTestBeacon({ canArm: () => state.canArm });
  const app = fakeAppState();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    startup: false,
    triggers: [
      foreground({ appState: app.appState }),
      interval({ every: 60_000 }),
    ],
    backoff: { first: 10_000, max: 10_000 },
  });
  beacon.start();
  await settle();
  vi.runAllTicks();

  state.canArm = false;
  app.emit("background");

  // The interval cannot arm its timer, nor can the gate arm the minimum interval or the wait of the failed check that follows.
  expect(() => app.emit("active")).not.toThrow();
  await settle();

  expect(() => vi.runAllTicks()).toThrow("The clock cannot arm a timer.");
  expect(mock.stats().reads).toBe(0);

  state.canArm = true;
  leave(app);
  await settle();

  expect(mock.stats().reads).toBe(1);
});
