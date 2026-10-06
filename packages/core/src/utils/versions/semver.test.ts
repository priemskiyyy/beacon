import fc from "fast-check";
import { expect, test } from "vitest";

import type { Comparison } from "src/types/Comparison";
import { semver } from "src/utils/versions/semver";

const strategy = semver();

const compare = (candidate: string, current: string) =>
  strategy.compare(strategy.parse(candidate), strategy.parse(current));

test("semver orders the precedence example of the specification", () => {
  const ascending = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.1",
    "1.1.0",
    "2.0.0",
  ];

  for (const [index, lower] of ascending.entries()) {
    for (const higher of ascending.slice(index + 1)) {
      expect(compare(higher, lower)).toBe("newer");
      expect(compare(lower, higher)).toBe("older");
    }

    expect(compare(lower, lower)).toBe("equal");
  }
});

test("VER-03 build metadata does not affect ordering and stays on the parsed version", () => {
  const withBuild = strategy.parse("1.2.3+build.7");

  expect(compare("1.2.3+build.7", "1.2.3+build.8")).toBe("equal");
  expect(compare("1.2.3+a", "1.2.3")).toBe("equal");
  expect(withBuild.raw).toBe("1.2.3+build.7");
  expect(withBuild.build).toEqual(["build", "7"]);
});

test("VER-04 a prerelease is not admitted unless prereleases are included", () => {
  const candidate = strategy.parse("2.0.0-rc.1");

  expect(strategy.compare(candidate, strategy.parse("1.9.0"))).toBe("newer");
  expect(strategy.admits(candidate)).toBe(false);
  expect(strategy.admits(strategy.parse("2.0.0"))).toBe(true);
});

test("VER-05 an included prerelease keeps its precedence and the strict grammar", () => {
  const permissive = semver({ prereleases: "include" });
  const candidate = permissive.parse("2.0.0-rc.1");

  expect(permissive.admits(candidate)).toBe(true);
  expect(permissive.compare(candidate, permissive.parse("2.0.0-beta.9"))).toBe(
    "newer",
  );
  expect(() => permissive.parse("v2.0.0-rc.1")).toThrow(
    expect.objectContaining({ code: "INVALID_VERSION" }),
  );
});

test("VER-06 malformed and coercible-looking strings are rejected", () => {
  const rejected = [
    "",
    "v1.2.3",
    "1.2",
    "1",
    "1.2.3.4",
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "1.2.3-",
    "1.2.3-01",
    "1.2.3-alpha..1",
    "1.2.3+",
    "1.2.3+build..1",
    " 1.2.3",
    "1.2.3 ",
    "1.2.3\n",
    "\n1.2.3",
    "١.٢.٣",
    "1.2.3-alpha_1",
    "1.2.x",
    "^1.2.3",
    "1.2.3-α",
  ];

  for (const input of rejected) {
    expect(() => strategy.parse(input)).toThrow(
      expect.objectContaining({ code: "INVALID_VERSION" }),
    );
  }
});

test("VER-06 a value that is no text is INVALID_VERSION, whatever an untyped caller hands over", () => {
  const strays: unknown[] = [
    undefined,
    null,
    1,
    1n,
    true,
    Symbol("v"),
    ["1.2.3"],
    { toString: () => "1.2.3" },
    Object.create(null),
  ];

  for (const input of strays) {
    expect(() => Reflect.apply(strategy.parse, undefined, [input])).toThrow(
      expect.objectContaining({ code: "INVALID_VERSION" }),
    );
  }
});

test("VER-07 numeric identifiers beyond the safe integer range compare exactly", () => {
  const huge = "9007199254740993";
  const nearby = "9007199254740992";

  expect(compare(`${huge}.0.0`, `${nearby}.0.0`)).toBe("newer");
  expect(compare(`1.${huge}.0`, `1.${nearby}.0`)).toBe("newer");
  expect(compare(`1.0.0-${huge}`, `1.0.0-${nearby}`)).toBe("newer");
  expect(strategy.parse(`${huge}.0.0`).major).toBe(huge);
});

test("a string longer than the parser bound is rejected", () => {
  expect(() => strategy.parse(`1.0.0-${"a".repeat(300)}`)).toThrow(
    expect.objectContaining({ code: "INVALID_VERSION" }),
  );
});

test("a parsed version is frozen", () => {
  const parsed = strategy.parse("1.2.3-alpha.1+build");

  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed.prerelease)).toBe(true);
  expect(Object.isFrozen(parsed.build)).toBe(true);
});

const decimal = fc.stringMatching(/^(0|[1-9][0-9]{0,30})$/);

const orderOf = (candidate: bigint, current: bigint): Comparison => {
  if (candidate > current) {
    return "newer";
  }

  if (candidate < current) {
    return "older";
  }

  return "equal";
};

test("VER-07 major, minor and patch of any size order as the tuple of the integers they name", () => {
  fc.assert(
    fc.property(
      fc.tuple(decimal, decimal, decimal),
      fc.tuple(decimal, decimal, decimal),
      (a, b) => {
        const orders = a.map((value, index) =>
          orderOf(BigInt(value), BigInt(b[index] ?? "0")),
        );

        const expected = orders.find((order) => order !== "equal") ?? "equal";

        expect(compare(a.join("."), b.join("."))).toBe(expected);
      },
    ),
    { numRuns: 500 },
  );
});

const identifier = fc.oneof(
  fc.nat(1_000).map(String),
  fc.constantFrom("alpha", "beta", "rc", "x-y"),
);

const version = fc
  .tuple(
    fc.nat(20),
    fc.nat(20),
    fc.nat(20),
    fc.array(identifier, { maxLength: 3 }),
  )
  .map(([major, minor, patch, prerelease]) => {
    const suffix = prerelease.length === 0 ? "" : `-${prerelease.join(".")}`;

    return `${major}.${minor}.${patch}${suffix}`;
  });

const OPPOSITE = {
  newer: "older",
  older: "newer",
  equal: "equal",
  incomparable: "incomparable",
} satisfies Record<Comparison, Comparison>;

test("comparison is reflexive and antisymmetric", () => {
  fc.assert(
    fc.property(version, version, (a, b) => {
      expect(compare(a, a)).toBe("equal");
      expect(compare(b, a)).toBe(OPPOSITE[compare(a, b)]);
    }),
  );
});

test("comparison is transitive", () => {
  fc.assert(
    fc.property(version, version, version, (a, b, c) => {
      fc.pre(compare(a, b) !== "older" && compare(b, c) !== "older");

      expect(compare(a, c)).not.toBe("older");
    }),
  );
});
