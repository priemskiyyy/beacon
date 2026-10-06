import { BeaconError } from "@priemskiyyy/beacon";
import fc from "fast-check";
import { expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import { parseStandardManifest } from "src/parseStandardManifest";
import { buildManifest, NOW, ROUTES } from "src/standardManifest.fixture";
import type { JsonObject } from "src/standardManifest.fixture";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`. The seed is never fixed to make a failure go away.

// The manifest is a trust boundary: whatever arrives, the parser answers a document or an `INVALID_DOCUMENT`, and never any other error.
const parse = (text: string) =>
  parseStandardManifest({ text, scope: SCOPE, routes: ROUTES, now: NOW });

type Outcome =
  | { status: "read"; read: ReturnType<typeof parse> }
  | { status: "refused"; error: unknown };

const readOutcome = (text: string): Outcome => {
  try {
    return { status: "read", read: parse(text) };
  } catch (error) {
    return { status: "refused", error };
  }
};

const expectDocumentOrRefusal = (text: string) => {
  const outcome = readOutcome(text);

  if (outcome.status === "read") {
    expect(Object.keys(outcome.read.document.routes).sort()).toEqual([
      "binary",
      "web",
    ]);

    return;
  }

  expect(outcome.error).toBeInstanceOf(BeaconError);
  expect(outcome.error).toMatchObject({ code: "INVALID_DOCUMENT" });
};

const PATHS = [
  ["schemaVersion"],
  ["application"],
  ["environment"],
  ["platform"],
  ["distribution"],
  ["decisionRevision"],
  ["decisionRevision", "kind"],
  ["decisionRevision", "domain"],
  ["decisionRevision", "epoch"],
  ["decisionRevision", "value"],
  ["issuedAt"],
  ["expiresAt"],
  ["routes"],
  ["routes", "web"],
  ["routes", "web", "kind"],
  ["routes", "web", "release"],
  ["routes", "web", "release", "identity"],
  ["routes", "web", "release", "identity", "value"],
  ["routes", "web", "release", "label"],
  ["routes", "web", "release", "metadata"],
  ["routes", "web", "release", "compatibility"],
  ["routes", "binary", "kind"],
  ["routes", "binary", "release", "order"],
  ["support"],
  ["support", "revision"],
  ["support", "subject"],
  ["support", "deniedReleaseIds"],
  ["support", "remediationRoute"],
];

// A copy of `target` with one place replaced by data, or taken away. The key is made an own property, so a `__proto__` one is a key and never a prototype.
const setIn = (
  target: JsonObject,
  path: string[],
  value: unknown,
): JsonObject => {
  const [head, ...rest] = path;

  if (head === undefined) {
    return target;
  }

  const copy = { ...target };

  if (rest.length === 0) {
    if (value === undefined) {
      delete copy[head];

      return copy;
    }

    Object.defineProperty(copy, head, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });

    return copy;
  }

  const child = target[head];

  if (typeof child !== "object" || child === null || Array.isArray(child)) {
    return target;
  }

  Object.defineProperty(copy, head, {
    value: setIn(Object.fromEntries(Object.entries(child)), rest, value),
    enumerable: true,
    writable: true,
    configurable: true,
  });

  return copy;
};

const mutate = (path: string[], value: unknown) =>
  JSON.stringify(setIn(buildManifest(), path, value));

const arbitraryValue = fc.oneof(
  fc.constant(undefined),
  fc.jsonValue({ maxDepth: 3 }),
  fc.string({ maxLength: 300 }),
  fc.constantFrom("__proto__", "constructor", "prototype", "", "9".repeat(400)),
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
);

test("HTTP-13 a valid manifest with one place replaced by arbitrary data is a document or an invalid document, never another error", () => {
  fc.assert(
    fc.property(fc.constantFrom(...PATHS), arbitraryValue, (path, value) => {
      expectDocumentOrRefusal(mutate(path, value));
    }),
    { numRuns: 3_000 },
  );
});

test("HTTP-13 any text at all is a document or an invalid document, never another error", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.string({ maxLength: 300 }),
        fc.json({ maxDepth: 5 }),
        fc.jsonValue({ maxDepth: 5 }).map((value) => JSON.stringify(value)),
      ),
      (text) => {
        const outcome = readOutcome(text);

        if (outcome.status === "read") {
          return;
        }

        expect(outcome.error).toBeInstanceOf(BeaconError);
        expect(outcome.error).toMatchObject({ code: "INVALID_DOCUMENT" });
      },
    ),
    { numRuns: 3_000 },
  );
});

test("SEC-01 a key that could corrupt a registry changes no prototype, wherever the manifest carries it", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("__proto__", "constructor", "prototype"),
      fc.constantFrom(
        ["routes"],
        ["routes", "web"],
        ["routes", "web", "release"],
        ["routes", "web", "release", "metadata"],
        ["support"],
        ["decisionRevision"],
        [],
      ),
      fc.jsonValue({ maxDepth: 2 }),
      (key, path, value) => {
        const text = mutate([...path, key], value);

        expectDocumentOrRefusal(text);
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
        expect(Reflect.get({}, "polluted")).toBeUndefined();
      },
    ),
    { numRuns: 500 },
  );
});

test("HTTP-12 a document over the byte limit is refused at once, whatever it holds", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 262_145, max: 600_000 }),
      fc.constantFrom(" ", "[", "a", "é"),
      (length, filler) => {
        const started = performance.now();
        const outcome = readOutcome(filler.repeat(length));

        expect(outcome.status).toBe("refused");
        expect(performance.now() - started).toBeLessThan(1_000);
      },
    ),
    { numRuns: 20 },
  );
});

test("HTTP-12 a document nested as deep as its size allows is refused or read, and never overflows", () => {
  const depth = 100_000;
  const text = `{"schemaVersion":1,"routes":${"[".repeat(depth)}${"]".repeat(depth)}}`;

  expect(readOutcome(text).status).toBe("refused");
});

test("HTTP-13 the identity a valid manifest names is the identity the document carries, whatever its text", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 256 }), (value) => {
      const outcome = readOutcome(
        JSON.stringify(
          setIn(
            buildManifest(),
            ["routes", "web", "release", "identity", "value"],
            value,
          ),
        ),
      );

      if (outcome.status === "refused") {
        expect(outcome.error).toMatchObject({ code: "INVALID_DOCUMENT" });

        return;
      }

      expect(outcome.read.document.routes.web).toMatchObject({
        kind: "target",
        release: { identity: { status: "known", value } },
      });
    }),
    { numRuns: 500 },
  );
});
