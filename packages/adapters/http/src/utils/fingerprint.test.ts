import { expect, test } from "vitest";

import { fingerprint } from "src/utils/fingerprint";

test("a fingerprint is sixteen hexadecimal digits", () => {
  expect(fingerprint("")).toMatch(/^[0-9a-f]{16}$/);
  expect(fingerprint("a decision")).toMatch(/^[0-9a-f]{16}$/);
});

test("the same text has the same fingerprint, and another text has another", () => {
  expect(fingerprint("web-build-a")).toBe(fingerprint("web-build-a"));
  expect(fingerprint("web-build-a")).not.toBe(fingerprint("web-build-b"));
  expect(fingerprint("ab")).not.toBe(fingerprint("ba"));
});
