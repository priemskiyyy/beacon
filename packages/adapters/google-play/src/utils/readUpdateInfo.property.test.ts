import fc from "fast-check";
import { expect, test } from "vitest";

import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import { readUpdateInfo } from "src/utils/readUpdateInfo";
import { readProgress } from "src/utils/readProgress";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`. The seed is never fixed to make a failure go away.

// What a native bridge hands over is a trust boundary: whatever its type says, an answer is one of Play's categories or an environment that cannot say, and never a throw or a made-up version.
const field = fc.oneof(
  fc.constantFrom(
    "available",
    "not-available",
    "in-progress",
    "unknown",
    "maybe",
    "",
  ),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.string({ maxLength: 20 }),
);

const stray = fc.record(
  {
    availability: field,
    versionCode: field,
    flexible: field,
    immediate: field,
    priority: field,
    stalenessDays: field,
    installStatus: field,
  },
  { requiredKeys: [] },
);

const toInfo = (value: unknown): PlayUpdateInfo =>
  JSON.parse(JSON.stringify(value ?? null));

test("PLAY-02 any answer is one of Play's categories or an environment that cannot say, and names a version only for a code Play can publish", () => {
  fc.assert(
    fc.property(stray, (value) => {
      const { observation } = readUpdateInfo(
        toInfo(value),
        "com.example.notes",
      );

      expect(["unknown", "none", "available"]).toContain(observation.status);

      if (observation.status !== "available") {
        return;
      }

      const { identity } = observation.offer.release;

      if (identity.status === "unknown") {
        expect(observation.offer.inProgress).toBe(true);

        return;
      }

      // A version is a positive whole number of at most Play's highest, written the way Play writes it.
      expect(identity.value).toMatch(/^[1-9][0-9]*$/);
      expect(Number(identity.value)).toBeLessThanOrEqual(2_100_000_000);
    }),
    { numRuns: 3_000 },
  );
});

test("PLAY-10 a progress is a fraction between 0 and 1, or nothing, whatever the counts the bridge gave", () => {
  const count = fc.oneof(
    fc.integer(),
    fc.double(),
    fc.constant(null),
    fc.constant(undefined),
    fc.string({ maxLength: 5 }),
  );

  fc.assert(
    fc.property(count, count, (bytesDownloaded, totalBytes) => {
      const progress = readProgress(
        JSON.parse(
          JSON.stringify({
            status: "downloading",
            bytesDownloaded,
            totalBytes,
          }),
        ),
      );

      expect(progress === null || (progress >= 0 && progress <= 1)).toBe(true);
    }),
    { numRuns: 3_000 },
  );
});
