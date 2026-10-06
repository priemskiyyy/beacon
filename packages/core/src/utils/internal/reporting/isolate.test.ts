import { expect, test, vi } from "vitest";

import { isolate } from "src/utils/internal/reporting/isolate";

test("a callback that throws reaches the reporter and nothing else", () => {
  const report = vi.fn();
  const failure = new Error("thrown");

  expect(() =>
    isolate(() => {
      throw failure;
    }, report),
  ).not.toThrow();
  expect(report).toHaveBeenCalledExactlyOnceWith(failure);
});

test("a callback that rejects reaches the reporter once its promise settles", async () => {
  const report = vi.fn();
  const failure = new Error("rejected");

  isolate(() => Promise.reject(failure), report);
  expect(report).not.toHaveBeenCalled();

  await Promise.resolve();
  await Promise.resolve();

  expect(report).toHaveBeenCalledExactlyOnceWith(failure);
});

test("a thenable that rejects is reported like a promise", async () => {
  const report = vi.fn();
  const failure = new Error("thenable");

  isolate(
    () => ({
      then: (_resolve: unknown, reject: (error: unknown) => void) =>
        reject(failure),
    }),
    report,
  );
  await Promise.resolve();
  await Promise.resolve();

  expect(report).toHaveBeenCalledExactlyOnceWith(failure);
});

test("a callback that answers a value, or a promise that keeps, reports nothing", async () => {
  const report = vi.fn();

  isolate(() => 1, report);
  isolate(() => undefined, report);
  isolate(() => Promise.resolve("done"), report);
  await Promise.resolve();
  await Promise.resolve();

  expect(report).not.toHaveBeenCalled();
});
