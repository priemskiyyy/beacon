import { describe, expect, test } from "vitest";

import type { ReleaseSourceConformanceOptions } from "src/testing/types/ReleaseSourceConformanceOptions";
import type { ReleaseSourceFixture } from "src/testing/types/ReleaseSourceFixture";
import type { DecisionRevision } from "src/types/DecisionRevision";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { SourceRead } from "src/types/SourceRead";

const DEFAULT_SCOPE: ReleaseScope = {
  application: "com.example.conformance",
  environment: "test",
  platform: "web",
  distribution: "public-web",
};

const read = <TDocument>(
  { source }: ReleaseSourceFixture<TDocument>,
  scope: ReleaseScope,
) =>
  source.read({
    scope,
    signal: new AbortController().signal,
    attempt: 1,
  });

const expectTimes = ({ expiresAt }: SourceRead<unknown>) => {
  if (expiresAt === undefined) {
    return;
  }

  expect(Number.isFinite(expiresAt)).toBe(true);
};

const expectNotEmpty = (value: string | undefined) => {
  if (value === undefined) {
    return;
  }

  expect(value).not.toBe("");
};

const expectOrdering = (revision: DecisionRevision | undefined) => {
  if (revision?.kind !== "ordered") {
    return;
  }

  expectNotEmpty(revision.domain);
  expectNotEmpty(revision.epoch);
};

const expectEvidence = ({ revision, digest, issuer }: SourceRead<unknown>) => {
  expectNotEmpty(revision?.value);
  expectNotEmpty(digest);
  expectNotEmpty(issuer);
  expectOrdering(revision);
};

/**
 * Registers the contract every release source keeps: it asks its backend for
 * nothing until it is read, it answers a document and evidence with real
 * times and non-empty identifiers, it can be read again, and every projection
 * of it belongs to it. Call it at the top level of `src/conformance.test.ts`,
 * over a fake backend.
 *
 * It cannot check that the document is the backend's real answer, or that a
 * failing backend rejects instead of answering an empty document: keep those
 * in the adapter's own tests.
 *
 * @example
 * ```ts
 * testReleaseSource({
 *   name: "http",
 *   create: () => {
 *     const backend = fakeBackend();
 *
 *     return { source: http({ request: backend.request }), reads: backend.reads };
 *   },
 * });
 * ```
 */
export const testReleaseSource = <TDocument>({
  name,
  create,
  scope = DEFAULT_SCOPE,
}: ReleaseSourceConformanceOptions<TDocument>) => {
  describe(`release source: ${name}`, () => {
    test("it has a name for diagnostics", () => {
      expect(create().source.name).not.toBe("");
    });

    test("creating it asks the backend for nothing", () => {
      const fixture = create();

      fixture.source.select((document) => document);

      expect(fixture.reads()).toBe(0);
    });

    test("a read answers a document with real times and identifiers", async () => {
      const answer = await read(create(), scope);

      expect(answer.document).toBeDefined();
      expectTimes(answer);
      expectEvidence(answer);
    });

    test("it can be read again, and every read asks the backend", async () => {
      const fixture = create();

      await read(fixture, scope);
      await read(fixture, scope);

      expect(fixture.reads()).toBe(2);
    });

    test("a projection belongs to its source and selects without reading", () => {
      const fixture = create();
      const projection = fixture.source.select((document) => document);

      expect(projection.source).toBe(fixture.source);
      expect(fixture.reads()).toBe(0);
    });
  });
};
