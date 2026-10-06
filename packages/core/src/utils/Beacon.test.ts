import { expect, test, vi } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import { Beacon } from "src/utils/Beacon";
import { SCOPE, buildWebRelease, createBeacon } from "src/utils/Beacon.fixture";

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
