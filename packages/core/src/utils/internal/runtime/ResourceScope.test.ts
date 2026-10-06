import { expect, test, vi } from "vitest";

import { ResourceScope } from "src/utils/internal/runtime/ResourceScope";

test("cleanups run once, in reverse order", () => {
  const scope = new ResourceScope(vi.fn());
  const log: string[] = [];

  scope.add(() => log.push("first"));
  scope.add(() => log.push("second"));
  scope.dispose();
  scope.dispose();

  expect(log).toEqual(["second", "first"]);
  expect(scope.isActive()).toBe(false);
});

test("SAFE-05 a cleanup that throws is reported and the others still run", () => {
  const report = vi.fn();
  const scope = new ResourceScope(report);
  const failure = new Error("cleanup");
  const last = vi.fn();

  scope.add(last);
  scope.add(() => {
    throw failure;
  });
  scope.dispose();

  expect(last).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(failure);
});

test("a cleanup added after the end runs at once", () => {
  const scope = new ResourceScope(vi.fn());
  const late = vi.fn();

  scope.dispose();
  scope.add(late);

  expect(late).toHaveBeenCalledTimes(1);
});

test("a cleanup taken back before the end never runs", () => {
  const scope = new ResourceScope(vi.fn());
  const kept = vi.fn();
  const released = vi.fn();

  scope.add(kept);
  scope.add(released)();
  scope.dispose();

  expect(kept).toHaveBeenCalledTimes(1);
  expect(released).not.toHaveBeenCalled();
});

test("the same cleanup added twice runs twice and each registration is taken back alone", () => {
  const scope = new ResourceScope(vi.fn());
  const cleanup = vi.fn();
  const takeBack = scope.add(cleanup);

  scope.add(cleanup);
  takeBack();
  scope.dispose();

  expect(cleanup).toHaveBeenCalledTimes(1);
});
