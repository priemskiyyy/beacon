import fc from "fast-check";
import { expect, test } from "vitest";

import { BeaconError } from "src/utils/BeaconError";
import { integer } from "src/utils/versions/integer";
import { semver } from "src/utils/versions/semver";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`. The seed is never fixed to make a failure go away.

// A version strategy's `parse` is a trust boundary: a manifest, a store and a bridge hand it whatever they hold, whatever its type says.
const anything = fc.oneof(
  fc.anything({ maxDepth: 3 }),
  fc.string({ maxLength: 80 }),
  fc.constantFrom(undefined, null, Number.NaN, Infinity, -0, 0n, Symbol("v")),
);

const parseOrRefusal = (parse: (input: never) => unknown, input: unknown) => {
  try {
    return {
      status: "parsed",
      value: Reflect.apply(parse, undefined, [input]),
    };
  } catch (error) {
    return { status: "refused", error };
  }
};

test("VER-06 a strategy parses what it can and refuses everything else with INVALID_VERSION, whatever it is handed", () => {
  const strategies = [semver().parse, integer().parse];

  fc.assert(
    fc.property(anything, (input) => {
      for (const parse of strategies) {
        const outcome = parseOrRefusal(parse, input);

        if (outcome.status === "parsed") {
          continue;
        }

        expect(outcome.error).toBeInstanceOf(BeaconError);
        expect(outcome.error).toMatchObject({ code: "INVALID_VERSION" });
      }
    }),
    { numRuns: 3_000 },
  );
});

test("VER-09 a decimal text the integer strategy accepts is the one it compares, and a text it refuses is never compared", () => {
  const strategy = integer();

  fc.assert(
    fc.property(fc.string({ maxLength: 30 }), (text) => {
      const outcome = parseOrRefusal(strategy.parse, text);

      if (outcome.status === "refused") {
        expect(/^(0|[1-9][0-9]*)$/.test(text)).toBe(false);

        return;
      }

      // Accepted means canonical: no sign, no fraction, no exponent, no leading zero, no space.
      expect(/^(0|[1-9][0-9]*)$/.test(text)).toBe(true);
      expect(outcome.value).toBe(text);
    }),
    { numRuns: 3_000 },
  );
});

test("VER-05 a text built from the semver grammar keeps its raw text when it parses, and equals itself", () => {
  const strategy = semver({ prereleases: "include" });

  const text = fc.stringMatching(
    /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})(-[0-9A-Za-z-]{1,8}(\.[0-9A-Za-z-]{1,8}){0,2})?(\+[0-9A-Za-z-]{1,8}(\.[0-9A-Za-z-]{1,8}){0,1})?$/,
  );

  fc.assert(
    fc.property(text, (input) => {
      const outcome = parseOrRefusal(strategy.parse, input);

      if (outcome.status === "refused") {
        // The grammar above is looser than SemVer in one place: a numeric prerelease identifier with a leading zero.
        expect(outcome.error).toMatchObject({ code: "INVALID_VERSION" });

        return;
      }

      expect(outcome.value).toMatchObject({ raw: input });
      expect(strategy.compare(outcome.value, outcome.value)).toBe("equal");
    }),
    { numRuns: 3_000 },
  );
});
