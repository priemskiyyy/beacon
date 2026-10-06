import { expect, test } from "vitest";

import { freezeList } from "src/utils/internal/common/freezeList";

test("a frozen list is the very list it was given, and can no longer change", () => {
  const items = ["web", "native"];
  const frozen = freezeList(items);

  expect(frozen).toBe(items);
  expect(Object.isFrozen(frozen)).toBe(true);
  expect(() => frozen.push("worker")).toThrow(TypeError);
  expect(frozen).toEqual(["web", "native"]);
});
