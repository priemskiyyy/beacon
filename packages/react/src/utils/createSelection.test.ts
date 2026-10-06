import { expect, test, vi } from "vitest";

import { createSelection } from "src/utils/createSelection";

test("the same value selects once", () => {
  const value = { count: 1 };
  const selector = vi.fn((current: { count: number }) => [current.count]);
  const read = createSelection(() => value, selector, Object.is);

  expect(read()).toBe(read());
  expect(selector).toHaveBeenCalledTimes(1);
});

test("an equal selection keeps the last reference, and a different one replaces it", () => {
  let value = { count: 1, label: "a" };

  const read = createSelection(
    () => value,
    ({ count }) => ({ count }),
    (previous, next) => previous.count === next.count,
  );

  const first = read();

  value = { count: 1, label: "b" };
  expect(read()).toBe(first);

  value = { count: 2, label: "b" };
  expect(read()).toEqual({ count: 2 });
  expect(read()).not.toBe(first);
});
