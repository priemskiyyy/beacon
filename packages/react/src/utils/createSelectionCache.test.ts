import { expect, test, vi } from "vitest";

import { createSelectionCache } from "src/utils/createSelectionCache";

test("the same value and selector select once", () => {
  const value = { count: 1 };
  const selector = vi.fn((current: { count: number }) => [current.count]);
  const select = createSelectionCache<{ count: number }, number[]>();

  expect(select(value, selector, Object.is)).toBe(
    select(value, selector, Object.is),
  );
  expect(selector).toHaveBeenCalledTimes(1);
});

test("an equal selection keeps the last reference, and a different one replaces it", () => {
  const select = createSelectionCache<
    { count: number; label: string },
    { count: number }
  >();

  const selector = ({ count }: { count: number }) => ({ count });

  const isEqual = (previous: { count: number }, next: { count: number }) =>
    previous.count === next.count;

  const first = select({ count: 1, label: "a" }, selector, isEqual);

  expect(select({ count: 1, label: "b" }, selector, isEqual)).toBe(first);

  const second = select({ count: 2, label: "b" }, selector, isEqual);

  expect(second).toEqual({ count: 2 });
  expect(second).not.toBe(first);
});

test("a value whose selection was equal is not selected again", () => {
  const select = createSelectionCache<{ count: number }, number>();
  const selector = vi.fn(({ count }: { count: number }) => count);

  select({ count: 1 }, selector, Object.is);

  const next = { count: 1 };

  select(next, selector, Object.is);
  select(next, selector, Object.is);

  expect(selector).toHaveBeenCalledTimes(2);
});

test("a new selector selects again, and an equal selection still keeps the last reference", () => {
  const value = { count: 1 };
  const select = createSelectionCache<{ count: number }, { count: number }>();

  const isEqual = (previous: { count: number }, next: { count: number }) =>
    previous.count === next.count;

  const first = select(value, ({ count }) => ({ count }), isEqual);

  expect(select(value, ({ count }) => ({ count }), isEqual)).toBe(first);
  expect(select(value, ({ count }) => ({ count: count + 1 }), isEqual)).toEqual(
    { count: 2 },
  );
});
