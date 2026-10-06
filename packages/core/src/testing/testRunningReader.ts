import { describe, expect, test } from "vitest";

import type { RunningReaderConformanceOptions } from "src/testing/types/RunningReaderConformanceOptions";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RunningReader } from "src/types/RunningReader";
import type { RunningRelease } from "src/types/RunningRelease";

const SCOPE: ReleaseScope = {
  application: "com.example.conformance",
  environment: "test",
  platform: "web",
  distribution: "conformance",
};

const isPrimitive = (value: unknown) =>
  value === null ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  typeof value === "number";

// A reader that throws is tolerated by Beacon, which makes it a failed fact as it does a rejection, but it is how a reader says nothing useful: it answers an unknown identity, or rejects.
const readWithoutThrowing = (reader: RunningReader, scope: ReleaseScope) => {
  try {
    return reader({ scope: Object.freeze({ ...scope }) });
  } catch (cause) {
    throw new Error(
      "The reader threw. A reader answers a release, or rejects, and never throws.",
      { cause },
    );
  }
};

// The journal compares identities exactly, so a space at either end is a build that never matches itself.
const expectText = (text: string, what: string) => {
  expect(typeof text, `${what} is text`).toBe("string");
  expect(text, `${what} is not empty`).not.toBe("");
  expect(text, `${what} has no space around it`).toBe(text.trim());
};

const expectRelease = ({ identity, label, raw }: RunningRelease) => {
  if (identity.status === "known") {
    expectText(identity.authority, "the authority");
    expectText(identity.domain, "the domain");
    expectText(identity.value, "the value");
  } else {
    expect(identity.status, "the identity is known or unknown").toBe("unknown");
    expectText(identity.reason, "the reason");
  }

  expect(
    label === null || (typeof label === "string" && label !== ""),
    "the label is null or a text that is not empty",
  ).toBe(true);

  const prototype = Object.getPrototypeOf(raw);

  expect(
    prototype === Object.prototype || prototype === null,
    "raw is a plain object",
  ).toBe(true);

  for (const [key, value] of Object.entries(raw)) {
    expect(
      isPrimitive(value),
      `raw.${key} is a text, a number, a boolean or null`,
    ).toBe(true);
  }

  // A number that is not finite is a primitive, and is what a copy turns into null.
  expect(JSON.parse(JSON.stringify(raw)), "raw survives a copy").toEqual(raw);
};

/**
 * Registers the contract every running reader keeps, over a fake of its host:
 * creating it asks the host for nothing, and reading it does; it answers a
 * release whose known identity has an authority, a domain and a value that are
 * not empty and have no space around them, whose unknown identity says why,
 * whose label is null or a text, and whose raw values are texts, finite
 * numbers, booleans or null that survive a copy; it answers the same release
 * for the same state on every read; and it never throws, answering an unknown
 * identity where the host cannot name what runs, or rejecting, which Beacon
 * publishes as a failed fact. It reads under a frozen scope, as Beacon does:
 * pass the `scope` the reader is meant for when its answer depends on it, such
 * as a native reader that takes the platform from it. `situations` are the
 * other states of the host, each with the answer the reader must give in it,
 * and a scope of its own when the scope is what changes. Call it at the top
 * level of a test file.
 *
 * It cannot check that the identity is the one the host reports, or that it
 * is written in the domain the route that pairs with it compares: keep those
 * in the reader's own tests.
 *
 * @example
 * ```ts
 * testRunningReader({
 *   name: "web build",
 *   create: () => ({ reader: () => ({
 *     identity: { status: "known", authority: "com.example.notes", domain: "web-artifact", value: "build-a" },
 *     label: "Build A",
 *     raw: {},
 *   }) }),
 * });
 * ```
 */
export const testRunningReader = ({
  name,
  create,
  scope = SCOPE,
  situations = [],
}: RunningReaderConformanceOptions) => {
  describe(`running reader: ${name}`, () => {
    test("creating it asks its host for nothing", ({ skip }) => {
      const { reads } = create();

      if (reads === undefined) {
        skip();

        return;
      }

      expect(reads()).toBe(0);
    });

    test("reading it asks its host, so the count that proves it cold is wired", async (context) => {
      const { skip } = context;

      const { reader, reads } = create();

      if (reads === undefined) {
        skip();

        return;
      }

      await readWithoutThrowing(reader, scope);

      expect(reads()).toBeGreaterThan(0);
    });

    test("it answers a release that names what runs, in the shape Beacon publishes", async () => {
      const { reader } = create();
      const release = await readWithoutThrowing(reader, scope);

      expect(release.identity.status).toBe("known");
      expectRelease(release);
    });

    test("it answers the same release for the same state on every read", async () => {
      const { reader } = create();
      const first = await readWithoutThrowing(reader, scope);

      expect(await readWithoutThrowing(reader, scope)).toEqual(first);
      expect(await readWithoutThrowing(reader, scope)).toEqual(first);
    });

    for (const situation of situations) {
      test(`where ${situation.name}, it answers ${situation.answers}`, async () => {
        const { reader } = situation.create();
        const read = situation.scope ?? scope;

        if (situation.answers === "rejection") {
          await expect(
            Promise.resolve(readWithoutThrowing(reader, read)),
          ).rejects.toBeDefined();

          return;
        }

        const release = await readWithoutThrowing(reader, read);

        expect(release.identity.status).toBe(situation.answers);
        expectRelease(release);
        expect(await readWithoutThrowing(reader, read)).toEqual(release);
      });
    }
  });
};
