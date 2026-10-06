import { afterEach, expect, test, vi } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { BeaconDiagnosticEvent } from "src/types/BeaconDiagnosticEvent";
import { INITIAL_DIAGNOSTICS } from "src/utils/constants/diagnostics";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";

afterEach(() => {
  vi.useRealTimers();
});

const createDiagnostics = () => {
  const clock = createTestClock({ now: 5_000 });
  const now = vi.fn(clock.now);
  const state: { session: number | null } = { session: null };

  const diagnostics = new Diagnostics({
    clock: { ...clock, now },
    getSession: () => state.session,
    getStatus: () => "idle",
  });

  return { diagnostics, now, state };
};

test("an event is frozen, stamped by the clock and names the session, and what it leaves out is null", () => {
  const { diagnostics, state } = createDiagnostics();
  const events: BeaconDiagnosticEvent[] = [];

  diagnostics.view.events.subscribe((event) => events.push(event));
  state.session = 3;
  diagnostics.record("read-started", { route: "web", attempt: 2 });

  expect(events).toEqual([
    {
      type: "read-started",
      timestamp: 5_000,
      session: 3,
      route: "web",
      command: null,
      attempt: 2,
      operation: null,
      reason: null,
    },
  ]);
  expect(Object.isFrozen(events[0])).toBe(true);
});

test("CORE-01 an event is built only while someone listens, and the counters count either way", () => {
  const { diagnostics, now } = createDiagnostics();

  diagnostics.record("late-callback");
  diagnostics.record("listener-error");
  diagnostics.record("listener-error");
  diagnostics.record("cleanup-error");
  diagnostics.record("session-started");

  expect(now).not.toHaveBeenCalled();
  expect(diagnostics.view.get().counters).toEqual({
    lateCallbacks: 1,
    listenerErrors: 2,
    cleanupErrors: 1,
  });

  const stop = diagnostics.view.events.subscribe(() => {});

  diagnostics.record("session-stopped");
  stop();
  diagnostics.record("session-started");

  expect(now).toHaveBeenCalledTimes(1);
});

test("the snapshot keeps its identity until it changes, and the initial one is what a server renders", () => {
  const { diagnostics, state } = createDiagnostics();
  const snapshot = diagnostics.view.get();

  expect(diagnostics.view.get()).toBe(snapshot);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.counters)).toBe(true);
  expect(diagnostics.view.getInitial()).toBe(INITIAL_DIAGNOSTICS);

  diagnostics.record("session-started");
  expect(diagnostics.view.get()).toBe(snapshot);

  state.session = 1;
  expect(diagnostics.view.get()).not.toBe(snapshot);

  diagnostics.record("late-callback");
  expect(diagnostics.view.get().counters.lateCallbacks).toBe(1);
});

test("the observers of the snapshot are told once, after the work of the turn", async () => {
  const { diagnostics } = createDiagnostics();
  const listener = vi.fn();

  diagnostics.view.subscribe(listener);
  diagnostics.record("session-started");
  diagnostics.record("late-callback");
  diagnostics.record("session-stopped");

  expect(listener).not.toHaveBeenCalled();

  await Promise.resolve();

  expect(listener).toHaveBeenCalledTimes(1);

  diagnostics.record("late-callback");
  await Promise.resolve();

  expect(listener).toHaveBeenCalledTimes(2);
});

test("nobody observing the snapshot means nothing is scheduled", async () => {
  const { diagnostics } = createDiagnostics();
  const listener = vi.fn();

  diagnostics.record("session-started");
  diagnostics.view.subscribe(listener)();
  await Promise.resolve();

  expect(listener).not.toHaveBeenCalled();
});

test("closing delivers the final snapshot at once, ends every observation and refuses new ones", async () => {
  const { diagnostics } = createDiagnostics();
  const snapshots = vi.fn();
  const events = vi.fn();

  diagnostics.view.subscribe(snapshots);
  diagnostics.view.events.subscribe(events);
  diagnostics.record("late-callback");
  diagnostics.close();
  diagnostics.close();

  expect(snapshots).toHaveBeenCalledTimes(1);

  await Promise.resolve();
  diagnostics.record("late-callback");

  const later = vi.fn();

  diagnostics.view.subscribe(later)();
  diagnostics.view.events.subscribe(later)();
  diagnostics.record("late-callback");
  await Promise.resolve();

  expect(snapshots).toHaveBeenCalledTimes(1);
  expect(events).toHaveBeenCalledTimes(1);
  expect(later).not.toHaveBeenCalled();
  expect(diagnostics.view.get().counters.lateCallbacks).toBe(1);
});

test("an event listener that leaves during a delivery is skipped", () => {
  const { diagnostics } = createDiagnostics();
  const removed = vi.fn();

  let leave = () => {};

  diagnostics.view.events.subscribe(() => leave());
  leave = diagnostics.view.events.subscribe(removed);
  diagnostics.record("session-started");

  expect(removed).not.toHaveBeenCalled();
});

test("every listener sees the events in the order they happened, even when one raises another", () => {
  const { diagnostics } = createDiagnostics();
  const first: string[] = [];
  const second: string[] = [];

  diagnostics.view.events.subscribe((event) => {
    first.push(event.type);

    if (event.type !== "session-started") {
      return;
    }

    diagnostics.record("session-stopped");
  });
  diagnostics.view.events.subscribe((event) => second.push(event.type));
  diagnostics.record("session-started");
  diagnostics.record("disposed");

  expect(first).toEqual(["session-started", "session-stopped", "disposed"]);
  expect(second).toEqual(first);
});

test("SEC-06 a listener that throws is rethrown outside and the others still hear the event", () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const { diagnostics } = createDiagnostics();
  const failure = new Error("sink down");
  const heard = vi.fn();

  diagnostics.view.events.subscribe(() => {
    throw failure;
  });
  diagnostics.view.events.subscribe(heard);
  diagnostics.record("session-started");

  expect(heard).toHaveBeenCalledTimes(1);
  expect(() => vi.runAllTicks()).toThrow(failure);
});
