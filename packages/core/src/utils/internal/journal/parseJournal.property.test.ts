import fc from "fast-check";
import { expect, test } from "vitest";

import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { StoredTransition } from "src/types/internal/StoredTransition";
import { parseJournal } from "src/utils/internal/journal/parseJournal";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`. The seed is never fixed to make a failure go away.

// The record is a trust boundary: whatever a storage hands back, the reader answers a list or `undefined`, and it never throws or runs anything.
const outcome = fc.constantFrom(
  null,
  "same-boot",
  "target-running",
  "target-not-running",
  "different-target",
  "inconclusive",
);

const identity: fc.Arbitrary<ReleaseIdentity> = fc.oneof(
  fc.record({
    status: fc.constant("known"),
    authority: fc.string({ maxLength: 40 }),
    domain: fc.string({ maxLength: 40 }),
    value: fc.string({ maxLength: 40 }),
  }),
  fc.record({
    status: fc.constant("unknown"),
    reason: fc.string({ maxLength: 40 }),
  }),
);

const transition: fc.Arbitrary<StoredTransition> = fc.record({
  intent: fc.record({
    operation: fc.record({ id: fc.integer({ min: 0, max: 1_000_000 }) }),
    boot: fc.record({ id: fc.string({ maxLength: 40 }) }),
    route: fc.string({ maxLength: 40 }),
    command: fc.string({ maxLength: 40 }),
    subject: fc.constantFrom("native", "bundle", "web", "worker"),
    current: fc.option(identity, { nil: null }),
    target: fc.option(identity, { nil: null }),
    binding: fc.constantFrom(
      "unpinned-navigation",
      "provider-current",
      "exact-instance",
      "store-destination",
    ),
    createdAt: fc.integer({ min: 0, max: 4_000_000_000_000 }),
    expiresAt: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  }),
  outcome,
  attempts: fc.integer({ min: 0, max: 1_000 }),
});

test("JOURNAL-10 a record the journal wrote reads back as it was written, whatever the texts in it", () => {
  fc.assert(
    fc.property(fc.array(transition, { maxLength: 8 }), (transitions) => {
      expect(parseJournal(serializeJournal(transitions))).toEqual(transitions);
    }),
    { numRuns: 500 },
  );
});

test("JOURNAL-10 any text at all is a list of transitions or nothing, and never an error", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.string({ maxLength: 200 }),
        fc.json({ maxDepth: 4 }),
        fc.jsonValue({ maxDepth: 4 }).map((value) => JSON.stringify(value)),
      ),
      (text) => {
        const read = parseJournal(text);

        expect(read === undefined || Array.isArray(read)).toBe(true);
      },
    ),
    { numRuns: 2_000 },
  );
});

test("JOURNAL-10 a version-1 record whose transitions are arbitrary data is ignored or read whole, never half read", () => {
  fc.assert(
    fc.property(
      fc.array(fc.jsonValue({ maxDepth: 4 }), { maxLength: 10 }),
      (items) => {
        const read = parseJournal(
          JSON.stringify({ version: 1, transitions: items }),
        );

        if (read === undefined) {
          return;
        }

        // What was read has exactly as many transitions as the record named, each with the layout the journal writes.
        expect(read).toHaveLength(items.length);
        expect(parseJournal(serializeJournal(read))).toEqual(read);
      },
    ),
    { numRuns: 2_000 },
  );
});

test("JOURNAL-10 a prototype-sensitive key changes no prototype and is read as no field", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("__proto__", "constructor", "prototype", "toString"),
      fc.jsonValue({ maxDepth: 2 }),
      (key, value) => {
        const text = `{"version":1,"transitions":[{"${key}":${JSON.stringify(value)}}]}`;

        expect(parseJournal(text)).toBeUndefined();
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
        expect(Reflect.get({}, "polluted")).toBeUndefined();
      },
    ),
    { numRuns: 200 },
  );
});

test("JOURNAL-10 a record larger than any record can be is refused at once, however it is made", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 65_537, max: 200_000 }),
      fc.constantFrom("[", "{", '"', " "),
      (length, filler) => {
        const started = performance.now();

        expect(parseJournal(filler.repeat(length))).toBeUndefined();
        expect(performance.now() - started).toBeLessThan(1_000);
      },
    ),
    { numRuns: 20 },
  );
});

test("JOURNAL-10 a record nested as deep as its size allows is ignored without throwing", () => {
  const depth = 30_000;
  const nested = `{"version":1,"transitions":${"[".repeat(depth)}${"]".repeat(depth)}}`;

  expect(parseJournal(nested)).toBeUndefined();
});
