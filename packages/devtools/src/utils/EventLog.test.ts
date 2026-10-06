import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { EventLog } from "src/utils/EventLog";

const event = (type: string): BeaconDiagnosticEvent => ({
  type: "session-started",
  timestamp: 1_000,
  session: 1,
  route: null,
  command: null,
  attempt: null,
  operation: null,
  reason: type,
});

const reasons = (log: EventLog) => log.get().map((entry) => entry.reason);

test("it keeps the newest events first within a limit clamped to 1 through 1000", () => {
  const none = new EventLog(0);

  none.add(event("a"));
  none.add(event("b"));
  expect(reasons(none)).toEqual(["b"]);

  const huge = new EventLog(50_000);

  for (let index = 0; index < 1_010; index += 1) {
    huge.add(event(String(index)));
  }

  expect(huge.get()).toHaveLength(1_000);
  expect(huge.get()[0]?.reason).toBe("1009");
  expect(huge.get().at(-1)?.reason).toBe("10");

  const negative = new EventLog(-3);

  negative.add(event("a"));
  negative.add(event("b"));
  expect(negative.get()).toHaveLength(1);

  const fractional = new EventLog(2.9);

  for (const type of ["a", "b", "c"]) {
    fractional.add(event(type));
  }

  expect(reasons(fractional)).toEqual(["c", "b"]);
});

test("a limit that is not a number falls back to 200", () => {
  const log = new EventLog(Number.NaN);

  for (let index = 0; index < 250; index += 1) {
    log.add(event(String(index)));
  }

  expect(log.get()).toHaveLength(200);
});

test("setLimit trims the oldest events at once and clamps like the constructor", async () => {
  const log = new EventLog(10);
  let notifications = 0;

  log.subscribe(() => {
    notifications += 1;
  });

  for (const type of ["a", "b", "c", "d"]) {
    log.add(event(type));
  }

  await Promise.resolve();
  expect(notifications).toBe(1);

  log.setLimit(2);
  expect(reasons(log)).toEqual(["d", "c"]);
  await Promise.resolve();
  expect(notifications).toBe(2);

  // Raising it again forgets nothing and tells nobody.
  log.setLimit(5_000);
  await Promise.resolve();
  expect(notifications).toBe(2);

  log.setLimit(0);
  expect(reasons(log)).toEqual(["d"]);
});

test("listeners are told once per microtask, and one that was removed, even during the pass, is not told", async () => {
  const log = new EventLog(10);
  const told: string[] = [];

  let stopSecond = () => {};

  log.subscribe(() => {
    told.push("first");
    stopSecond();
  });
  stopSecond = log.subscribe(() => told.push("second"));

  const stopOther = log.subscribe(() => told.push("other"));

  log.add(event("a"));
  log.add(event("b"));
  expect(told).toEqual([]);

  stopOther();
  await Promise.resolve();
  // The first one told and removed the second before the second's turn.
  expect(told).toEqual(["first"]);

  log.add(event("c"));
  await Promise.resolve();
  expect(told).toEqual(["first", "first"]);
});

test("ids only grow, the last one survives a clear, and a clear tells the listeners", async () => {
  const log = new EventLog(10);
  let notifications = 0;

  log.subscribe(() => {
    notifications += 1;
  });

  expect(log.getLastId()).toBe(0);
  log.add(event("a"));
  log.add(event("b"));
  expect(log.get().map((entry) => entry.id)).toEqual([2, 1]);

  log.clear();
  expect(log.get()).toEqual([]);
  expect(log.getLastId()).toBe(2);
  await Promise.resolve();
  expect(notifications).toBe(1);

  log.add(event("c"));
  expect(log.get().map((entry) => entry.id)).toEqual([3]);
});

test("the newest failure is remembered past a clear and past the events that push its record out", () => {
  const log = new EventLog(1);

  expect(log.getLastFailureId()).toBe(0);
  log.add({ ...event("a"), type: "route-failed" });
  log.add(event("b"));
  log.add(event("c"));
  expect(log.get().map((entry) => entry.id)).toEqual([3]);
  expect(log.getLastFailureId()).toBe(1);

  log.clear();
  expect(log.getLastFailureId()).toBe(1);

  log.add({ ...event("d"), type: "late-callback" });
  expect(log.getLastFailureId()).toBe(4);
});

test("what it stores is a bounded copy, so the history retains nothing of the event", () => {
  const log = new EventLog(10);
  const sent = event("a");

  log.add(sent);
  Object.assign(sent, { reason: "changed", route: "later" });
  expect(log.get()[0]).toMatchObject({ reason: "a", route: null });
});
