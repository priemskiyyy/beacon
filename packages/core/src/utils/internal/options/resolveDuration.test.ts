import { expect, test } from "vitest";

import { resolveDuration } from "src/utils/internal/options/resolveDuration";

test("a left-out duration is its default and a given one is kept", () => {
  expect(resolveDuration("timeouts.running", undefined, 5_000)).toBe(5_000);
  expect(resolveDuration("timeouts.running", 250, 5_000)).toBe(250);
});

test("a duration that is not a positive whole number is refused", () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => resolveDuration("timeouts.running", value, 5_000)).toThrow(
      expect.objectContaining({
        code: "INVALID_CONFIGURATION",
        message:
          "timeouts.running must be a positive whole number of milliseconds.",
      }),
    );
  }
});
