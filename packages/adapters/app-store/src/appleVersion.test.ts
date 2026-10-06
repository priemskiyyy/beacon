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
