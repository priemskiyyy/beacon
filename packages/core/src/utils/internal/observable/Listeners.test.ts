import { afterEach, expect, test, vi } from "vitest";

import { Listeners } from "src/utils/internal/observable/Listeners";

afterEach(() => {
  vi.useRealTimers();
});

test("CORE-12 the same callback registered twice is two registrations", () => {
  const listeners = new Listeners();
  const listener = vi.fn();
  const removeFirst = listeners.add(listener);

  listeners.add(listener);
  removeFirst();
  removeFirst();
  listeners.notify();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listeners.size()).toBe(1);
});

test("CORE-10 a listener added during a pass waits for the next one", () => {
  const listeners = new Listeners();
  const late = vi.fn();

  listeners.add(() => {
    listeners.add(late);
  });
  listeners.notify();

  expect(late).not.toHaveBeenCalled();
  listeners.notify();
  expect(late).toHaveBeenCalledTimes(1);
});

test("CORE-09 a listener removed during a pass is skipped", () => {
  const listeners = new Listeners();
  const removed = vi.fn();

  let remove = () => {};

  listeners.add(() => remove());
  remove = listeners.add(removed);
  listeners.notify();

  expect(removed).not.toHaveBeenCalled();
});

test("CORE-08 a throwing or rejecting listener reaches the reporter and the others still run", async () => {
  const report = vi.fn();
  const listeners = new Listeners(report);
  const thrown = new Error("thrown");
  const rejected = new Error("rejected");
  const after = vi.fn();

  listeners.add(() => {
    throw thrown;
  });
  listeners.add(() => Promise.reject(rejected));
  listeners.add(after);
  listeners.notify();
  await Promise.resolve();

  expect(after).toHaveBeenCalledTimes(1);
  expect(report.mock.calls).toEqual([[thrown], [rejected]]);
});

test("CORE-11 a nested pass supersedes the rest of the outer one", () => {
  const listeners = new Listeners();
  const log: string[] = [];

  let nested = false;

  listeners.add(() => {
    log.push("first");

    if (nested) {
      return;
    }

    nested = true;
    listeners.notify();
  });
  listeners.add(() => log.push("second"));
  listeners.notify();

  expect(log).toEqual(["first", "first", "second"]);
});

test("LIFE-06 clearing during a pass stops it", () => {
  const listeners = new Listeners();
  const after = vi.fn();

  listeners.add(() => listeners.clear());
  listeners.add(after);
  listeners.notify();

  expect(after).not.toHaveBeenCalled();
  expect(listeners.size()).toBe(0);
});

test("an unreported failure is rethrown outside the pass", () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const listeners = new Listeners();
  const failure = new Error("listener");

  listeners.add(() => {
    throw failure;
  });
  listeners.notify();

  expect(() => vi.runAllTicks()).toThrow(failure);
});
