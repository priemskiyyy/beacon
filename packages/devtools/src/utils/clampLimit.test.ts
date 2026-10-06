import { expect, test } from "vitest";

import { clampLimit } from "src/utils/clampLimit";

test("a limit is kept within 1 through 1000 and cut to a whole number", () => {
  expect(clampLimit(1)).toBe(1);
  expect(clampLimit(200)).toBe(200);
  expect(clampLimit(1_000)).toBe(1_000);
  expect(clampLimit(0)).toBe(1);
  expect(clampLimit(-40)).toBe(1);
  expect(clampLimit(1_001)).toBe(1_000);
  expect(clampLimit(Number.POSITIVE_INFINITY)).toBe(1_000);
  expect(clampLimit(Number.NEGATIVE_INFINITY)).toBe(1);
  expect(clampLimit(12.9)).toBe(12);
});

test("what is not a number becomes the default", () => {
  expect(clampLimit(Number.NaN)).toBe(200);
});
