import { afterEach, expect, test, vi } from "vitest";

import { MAX_TIMER_DELAY } from "src/utils/constants/timers";
import { createSystemClock } from "src/utils/internal/clock/createSystemClock";

afterEach(() => {
  vi.useRealTimers();
});

test("the system clock runs a timer once and its cancel stops it", () => {
  vi.useFakeTimers();

  const clock = createSystemClock();
  const fired = vi.fn();
  const cancelled = vi.fn();

  clock.setTimer(fired, 100);
  clock.setTimer(cancelled, 100)();
  vi.advanceTimersByTime(100);

  expect(fired).toHaveBeenCalledTimes(1);
  expect(cancelled).not.toHaveBeenCalled();
});

test("the system clock keeps a delay a host timer can hold", () => {
  vi.useFakeTimers();

  const spy = vi.spyOn(globalThis, "setTimeout");
  const clock = createSystemClock();

  clock.setTimer(() => {}, Number.MAX_SAFE_INTEGER);
  clock.setTimer(() => {}, -5);

  expect(spy.mock.calls.map(([, delay]) => delay)).toEqual([
    MAX_TIMER_DELAY,
    0,
  ]);
});

test("the system clock reads epoch and monotonic time", () => {
  const clock = createSystemClock();

  expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1_000);
  expect(clock.monotonic()).toBeGreaterThanOrEqual(0);
});
