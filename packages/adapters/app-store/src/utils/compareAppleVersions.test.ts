import { expect, test } from "vitest";

import { compareAppleVersions } from "src/utils/compareAppleVersions";

test("versions are ordered number by number, from the major one down", () => {
  expect(compareAppleVersions([3, 3, 0], [3, 2, 9])).toBe("newer");
  expect(compareAppleVersions([3, 2, 0], [3, 2, 1])).toBe("older");
  expect(compareAppleVersions([10, 0, 0], [9, 9, 9])).toBe("newer");
  expect(compareAppleVersions([3, 2, 0], [3, 2, 0])).toBe("equal");
});
