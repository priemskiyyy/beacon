import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";

test("advancing runs due timers in order, each at its own time", () => {
  const clock = createTestClock({ now: 1_000 });
  const log: Array<[string, number, number]> = [];

  clock.setTimer(() => log.push(["late", clock.now(), clock.monotonic()]), 300);
  clock.setTimer(
    () => log.push(["early", clock.now(), clock.monotonic()]),
    100,
  );
  clock.advance(500);

  expect(log).toEqual([
    ["early", 1_100, 100],
    ["late", 1_300, 300],
  ]);
  expect(clock.now()).toBe(1_500);
  expect(clock.pendingTimers()).toBe(0);
});

test("a timer armed by a timer runs in the same advance when it falls due", () => {
  const clock = createTestClock();
  const log: number[] = [];

  clock.setTimer(() => {
    log.push(clock.monotonic());
    clock.setTimer(() => log.push(clock.monotonic()), 100);
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

test("skipping time runs no timer until the runtime runs again", () => {
  const clock = createTestClock();
  const log: string[] = [];

  clock.setTimer(() => log.push("due"), 100);
  clock.skip(10_000);

  expect(log).toEqual([]);

  clock.runDue();
  expect(log).toEqual(["due"]);
  expect(clock.monotonic()).toBe(10_000);
});

test("epoch time moves alone, backwards included", () => {
  const clock = createTestClock({ now: 5_000, monotonic: 7 });

  clock.setNow(1_000);

  expect(clock.now()).toBe(1_000);
  expect(clock.monotonic()).toBe(7);
});

test("an overdue timer runs at the time it runs, never back at its due time", () => {
  const clock = createTestClock();
  const seen: number[] = [];

  clock.setTimer(() => seen.push(clock.monotonic()), 500);
  clock.skip(1_000);
  clock.advance(0);

  expect(seen).toEqual([1_000]);
});

test("time never moves backwards or by a duration that is not a number of milliseconds", () => {
  const clock = createTestClock();

  for (const milliseconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => clock.advance(milliseconds)).toThrow(
      "A test clock moves forward by zero or more milliseconds.",
    );
    expect(() => clock.skip(milliseconds)).toThrow(
      "A test clock moves forward by zero or more milliseconds.",
    );
  }

  expect(clock.monotonic()).toBe(0);
});

test("a timer that moves the clock past the advance never moves it back", () => {
  const clock = createTestClock();

  clock.setTimer(() => clock.skip(1_000), 50);
  clock.advance(100);

  expect(clock.monotonic()).toBe(1_050);
});
