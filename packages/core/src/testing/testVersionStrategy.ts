import { describe, expect, test } from "vitest";

import type { VersionStrategyConformanceOptions } from "src/testing/types/VersionStrategyConformanceOptions";

/**
 * Registers the contract every version strategy keeps: the same input
 * compares equal to itself, `newer` and `older` mirror each other, the
 * ascending inputs compare in order, and a value that breaks the grammar
 * throws instead of being guessed. Call it at the top level of a test file.
 *
 * It cannot check that the order is the domain's real one: keep that in the
 * strategy's own tests.
 *
 * @example
 * ```ts
 * testVersionStrategy({
 *   name: "release-train",
 *   create: () => trains,
 *   ascending: ["2026.1", "2026.2"],
 *   invalid: ["latest"],
 * });
 * ```
 */
export const testVersionStrategy = <TParsed, TInput>({
  name,
  create,
  ascending,
  invalid,
}: VersionStrategyConformanceOptions<TParsed, TInput>) => {
  describe(`version strategy: ${name}`, () => {
    test("it has a name for diagnostics", () => {
      expect(create().name).not.toBe("");
    });

    test("an input compares equal to itself", () => {
      const strategy = create();

      for (const input of ascending) {
        expect(
          strategy.compare(strategy.parse(input), strategy.parse(input)),
        ).toBe("equal");
      }
    });

    test("newer and older mirror each other along the ascending inputs", () => {
      const strategy = create();

      for (const [index, older] of ascending.entries()) {
        const newer = ascending[index + 1];

        if (newer === undefined) {
          continue;
        }

        expect(
          strategy.compare(strategy.parse(newer), strategy.parse(older)),
        ).toBe("newer");
        expect(
          strategy.compare(strategy.parse(older), strategy.parse(newer)),
        ).toBe("older");
      }
    });

    test("an input that breaks the grammar throws instead of being guessed", () => {
      const strategy = create();

      for (const input of invalid) {
        expect(() => strategy.parse(input)).toThrow();
      }
    });
  });
};
