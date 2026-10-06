import { expect, test } from "vitest";

import { appleVersion } from "src/appleVersion";

test("three and three point zero are the same marketing version", () => {
  const strategy = appleVersion();

  expect(strategy.compare(strategy.parse("3.2"), strategy.parse("3.2.0"))).toBe(
    "equal",
  );
});

test("the strategy is named for diagnostics", () => {
  expect(appleVersion().name).toBe("apple-marketing-version");
});

test("STORE-08 only marketing versions are ordered, so a build number that resets orders nothing", () => {
  const strategy = appleVersion();

  expect(
    strategy.compare(strategy.parse("3.3.0"), strategy.parse("3.2.9")),
  ).toBe("newer");

  for (const withBuild of ["3.3.0.1", "3.3.0 (1)", "3.3.0+1"]) {
    expect(() => strategy.parse(withBuild)).toThrow(
      expect.objectContaining({ code: "INVALID_VERSION" }),
    );
  }
});
