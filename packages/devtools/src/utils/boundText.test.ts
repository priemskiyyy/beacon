import { expect, test } from "vitest";

import { boundText } from "src/utils/boundText";

test("a text within its limit is kept as it is", () => {
  expect(boundText("short")).toBe("short");
  expect(boundText("x".repeat(200))).toBe("x".repeat(200));
  expect(boundText("abc", 3)).toBe("abc");
});

test("a longer text is cut at the limit and says so", () => {
  expect(boundText("x".repeat(201))).toBe(`${"x".repeat(200)}… [Truncated]`);
  expect(boundText("abcd", 3)).toBe("abc… [Truncated]");
});
