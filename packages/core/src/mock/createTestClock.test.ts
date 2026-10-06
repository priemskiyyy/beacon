import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";

test("advancing runs due timers in order, each at its own time", () => {
  const clock = createTestClock({ now: 1_000 });
  const log: Array<[string, number]> = [];

  clock.setTimer(() => log.push(["late", clock.now()]), 300);
  clock.setTimer(() => log.push(["early", clock.now()]), 100);
  clock.advance(500);

  expect(log).toEqual([
    ["early", 1_100],
    ["late", 1_300],
  ]);
  expect(clock.now()).toBe(1_500);
  expect(clock.pendingTimers()).toBe(0);
});

test("a timer armed by a timer runs in the same advance when it falls due", () => {
  const clock = createTestClock();
  const log: number[] = [];

  clock.setTimer(() => {
    log.push(clock.now());
    clock.setTimer(() => log.push(clock.now()), 100);
  }, 100);
  clock.advance(250);

  expect(log).toEqual([100, 200]);
});

test("a cancelled timer never runs", () => {
  const clock = createTestClock();
  const log: string[] = [];

  clock.setTimer(() => log.push("cancelled"), 10)();
  clock.advance(10);

  expect(log).toEqual([]);
});

test("suspending runs no timer until the runtime runs again", () => {
  const clock = createTestClock();
  const log: string[] = [];

  clock.setTimer(() => log.push("due"), 100);
  clock.suspend(10_000);

  expect(log).toEqual([]);

  clock.advance(0);
  expect(log).toEqual(["due"]);
  expect(clock.now()).toBe(10_000);
});

test("epoch time moves alone, backwards included, and timers keep their own course", () => {
  const clock = createTestClock({ now: 5_000 });
  const log: number[] = [];

  clock.setTimer(() => log.push(clock.now()), 100);
  clock.setNow(1_000);

  expect(clock.now()).toBe(1_000);

  clock.advance(100);

  expect(log).toEqual([1_100]);
});

test("an overdue timer runs at the time it runs, never back at its due time", () => {
  const clock = createTestClock();
  const seen: number[] = [];

  clock.setTimer(() => seen.push(clock.now()), 500);
  clock.suspend(1_000);
  clock.advance(0);

  expect(seen).toEqual([1_000]);
});

test("a timer armed with a delay that is not a number of milliseconds runs at once, as a platform timer does", () => {
  const clock = createTestClock();
  const log: string[] = [];

  clock.setTimer(() => log.push("ran"), Number.NaN);
  clock.advance(0);

  expect(log).toEqual(["ran"]);
  expect(clock.now()).toBe(0);
});

test("time never moves backwards or by a duration that is not a number of milliseconds", () => {
  const clock = createTestClock();

  for (const milliseconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => clock.advance(milliseconds)).toThrow(
      "A test clock moves forward by zero or more milliseconds.",
    );
    expect(() => clock.suspend(milliseconds)).toThrow(
      "A test clock moves forward by zero or more milliseconds.",
    );
  }

  expect(clock.now()).toBe(0);
});

test("a timer that moves the clock past the advance never moves it back", () => {
  const clock = createTestClock();

  clock.setTimer(() => clock.suspend(1_000), 50);
  clock.advance(100);

  expect(clock.now()).toBe(1_050);
});
