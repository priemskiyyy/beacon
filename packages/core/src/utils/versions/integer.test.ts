import fc from "fast-check";
import { expect, test } from "vitest";

import { integer } from "src/utils/versions/integer";

const strategy = integer();

const compare = (candidate: number | string, current: number | string) =>
  strategy.compare(strategy.parse(candidate), strategy.parse(current));

test("VER-07 very large decimal strings compare exactly beyond the safe integer range", () => {
  expect(compare("9007199254740993", "9007199254740992")).toBe("newer");
  expect(compare("9007199254740992", "9007199254740993")).toBe("older");
  expect(
    compare("123456789012345678901234567890", "123456789012345678901234567890"),
  ).toBe("equal");
  expect(compare("100000000000000000000", "99999999999999999999")).toBe(
    "newer",
  );
});

test("VER-08 an unsafe numeric revision fails instead of being rounded", () => {
  expect(() => strategy.parse(Number("9007199254740993"))).toThrow(
    expect.objectContaining({ code: "INVALID_VERSION" }),
  );
  expect(() => strategy.parse(Number.MAX_VALUE)).toThrow(
    expect.objectContaining({ code: "INVALID_VERSION" }),
  );
});

test("VER-09 signs, fractions, exponents, leading zeros and whitespace are rejected", () => {
  const rejected: Array<number | string> = [
    "",
    "-1",
    "+1",
    "1.5",
    "1e3",
    "0x10",
    "007",
    " 7",
    "7 ",
    "7\n",
    "٧",
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];

  for (const input of rejected) {
    expect(() => strategy.parse(input)).toThrow(
      expect.objectContaining({ code: "INVALID_VERSION" }),
    );
  }
});

test("a safe integer and its canonical string parse to the same value", () => {
  expect(strategy.parse(108)).toBe("108");
  expect(strategy.parse("108")).toBe("108");
  expect(strategy.parse(0)).toBe("0");
  expect(strategy.parse(-0)).toBe("0");
  expect(compare(108, "108")).toBe("equal");
});

test("a string longer than the digit bound is rejected", () => {
  expect(() => strategy.parse("1".repeat(65))).toThrow(
    expect.objectContaining({ code: "INVALID_VERSION" }),
  );
});

test("integers order like the numbers they name", () => {
  fc.assert(
    fc.property(fc.nat(), fc.nat(), (a, b) => {
      const expected = ((): "older" | "equal" | "newer" => {
        if (a > b) {
          return "newer";
        }

        if (a < b) {
          return "older";
        }

        return "equal";
      })();

      expect(compare(a, b)).toBe(expected);
      expect(compare(String(a), b)).toBe(expected);
    }),
  );
});

const decimal = fc.stringMatching(/^(0|[1-9][0-9]{0,40})$/);

test("VER-07 decimal strings of any size order like the integers they name", () => {
  fc.assert(
    fc.property(decimal, decimal, (a, b) => {
      const [left, right] = [BigInt(a), BigInt(b)];

      if (left > right) {
        expect(compare(a, b)).toBe("newer");
      } else if (left < right) {
        expect(compare(a, b)).toBe("older");
      } else {
        expect(compare(a, b)).toBe("equal");
      }
    }),
    { numRuns: 500 },
  );
});

test("every integer is admitted", () => {
  expect(strategy.admits(strategy.parse(1))).toBe(true);
});
