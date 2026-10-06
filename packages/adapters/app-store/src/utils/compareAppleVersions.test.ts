import { expect, test } from "vitest";

import { compareAppleVersions } from "src/utils/compareAppleVersions";

test("versions are ordered number by number, from the major one down", () => {
  expect(compareAppleVersions([3, 3, 0], [3, 2, 9])).toBe("newer");
  expect(compareAppleVersions([3, 2, 0], [3, 2, 1])).toBe("older");
  expect(compareAppleVersions([10, 0, 0], [9, 9, 9])).toBe("newer");
  expect(compareAppleVersions([3, 2, 0], [3, 2, 0])).toBe("equal");
  expect(compareAppleVersions([2, 9, 9], [3, 0, 0])).toBe("older");
  expect(compareAppleVersions([3, 1, 9], [3, 2, 0])).toBe("older");
});

test("nine digits in every number are still ordered exactly", () => {
  const most = 999_999_999;

  expect(compareAppleVersions([most, 0, 0], [most - 1, most, most])).toBe(
    "newer",
  );
  expect(compareAppleVersions([most - 1, most, most], [most, 0, 0])).toBe(
    "older",
  );
});
