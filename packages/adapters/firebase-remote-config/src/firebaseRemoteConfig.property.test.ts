import { createTestClock } from "@priemskiyyy/beacon/mock";
import fc from "fast-check";
import { expect, test } from "vitest";

import { SCOPE } from "src/fakeRemoteConfig.fixture";
import { firebaseRemoteConfig } from "src/firebaseRemoteConfig";
import type { RemoteConfigLike } from "src/types/RemoteConfigLike";
import type { RemoteConfigModuleLike } from "src/types/RemoteConfigModuleLike";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`. The seed is never fixed to make a failure go away.

// What an SDK says is a trust boundary: the source of a value and the time of a fetch are whatever the native side answers.
const build = (source: string, text: string, fetchTimeMillis: number) => {
  const remoteConfig: RemoteConfigLike = {
    fetchTimeMillis,
    settings: { minimumFetchIntervalMillis: 3_600_000 },
  };

  const sdk: RemoteConfigModuleLike<RemoteConfigLike> = {
    ensureInitialized: async () => {},
    fetchAndActivate: async () => true,
    getValue: () => ({ asString: () => text, getSource: () => source }),
  };

  return firebaseRemoteConfig({
    remoteConfig,
    sdk,
    document: ({ remote, source: sourceOf }) => ({
      value: remote("minimum_build"),
      where: sourceOf("minimum_build"),
    }),
  });
};

const read = (source: string, text: string, fetchTimeMillis: number) =>
  build(source, text, fetchTimeMillis).read({
    scope: SCOPE,
    signal: new AbortController().signal,
    attempt: 1,
    clock: createTestClock(),
  });

test("SEC-02 only a value the server sent is read as the server's, whatever source the SDK names", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.constantFrom("remote", "default", "static", "unknown", ""),
        fc.string({ maxLength: 20 }),
      ),
      fc.string({ maxLength: 40 }),
      async (source, text) => {
        const outcome = await read(source, text, 1_000_000).then(
          (answer) => ({ status: "read", answer }),
          (error) => ({ status: "refused", error }),
        );

        if (source === "remote") {
          expect(outcome).toMatchObject({
            status: "read",
            answer: { document: { value: text, where: "remote" } },
          });

          return;
        }

        // A default, a key nothing defines and a source nobody can name are never a server's answer.
        expect(outcome).toMatchObject({
          status: "refused",
          error: { code: "SOURCE_FAILED" },
        });
      },
    ),
    { numRuns: 500 },
  );
});

test("SEC-03 a fetch that left no time is a refused read, and any time it did leave dates the answer from that time", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.integer({ min: -5, max: 5_000_000_000_000 }),
        fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, -1),
      ),
      async (fetchTimeMillis) => {
        const outcome = await read("remote", "120", fetchTimeMillis).then(
          (answer) => ({ status: "read", answer }),
          (error) => ({ status: "refused", error }),
        );

        if (!(fetchTimeMillis > 0)) {
          expect(outcome).toMatchObject({
            status: "refused",
            error: { code: "SOURCE_FAILED" },
          });

          return;
        }

        expect(outcome).toMatchObject({
          status: "read",
          answer: { expiresAt: fetchTimeMillis + 3_600_000 },
        });
      },
    ),
    { numRuns: 500 },
  );
});
