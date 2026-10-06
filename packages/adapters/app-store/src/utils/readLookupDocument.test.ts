import { expect, test } from "vitest";

import { APP_ID, BUNDLE_ID, entry } from "src/fakeStore.fixture";
import { readLookupDocument } from "src/utils/readLookupDocument";

const EXPECTED = { appId: APP_ID, bundleId: BUNDLE_ID };

test("a matching entry is a candidate marketing version, bound to the configured app", () => {
  expect(readLookupDocument({ results: [entry()] }, EXPECTED)).toEqual({
    decision: {
      kind: "candidate",
      release: {
        identity: {
          status: "known",
          authority: APP_ID,
          domain: "apple-marketing-version",
          value: "3.3.0",
        },
        label: "3.3.0",
        metadata: { releasedAt: Date.parse("2026-09-02T09:15:00Z") },
        order: "3.3.0",
      },
    },
  });
});

test("STORE-01 no entry is nothing matched in that lookup context, not proof that no update exists", () => {
  expect(readLookupDocument({ results: [] }, EXPECTED)).toEqual({
    decision: { kind: "none", reason: "no-match" },
  });
});

test("several entries for one app are refused, not resolved by guessing", () => {
  expect(() =>
    readLookupDocument(
      { results: [entry(), entry({ version: "3.4.0" })] },
      EXPECTED,
    ),
  ).toThrow("several entries");
});

test("STORE-02 an entry of another app is refused", () => {
  expect(() =>
    readLookupDocument({ results: [entry({ trackId: 1 })] }, EXPECTED),
  ).toThrow("another app id");
});

test("STORE-02 an entry of another bundle is refused, and the bundle is checked only when configured", () => {
  const other = entry({ bundleId: "com.example.other" });

  expect(() => readLookupDocument({ results: [other] }, EXPECTED)).toThrow(
    "another bundle id",
  );
  expect(
    readLookupDocument(
      { results: [other] },
      { appId: APP_ID, bundleId: undefined },
    ),
  ).toMatchObject({ decision: { kind: "candidate" } });
});

test("an entry with no version is refused", () => {
  expect(() =>
    readLookupDocument({ results: [entry({ version: "" })] }, EXPECTED),
  ).toThrow("no version");
});

test.each([
  [".5", 500],
  [".05", 50],
  [".123", 123],
])(
  "the fraction %s of a second in a release date is read as %i milliseconds",
  (fraction, milliseconds) => {
    const currentVersionReleaseDate = `2026-09-02T09:15:00${fraction}Z`;

    expect(
      readLookupDocument(
        { results: [entry({ currentVersionReleaseDate })] },
        EXPECTED,
      ),
    ).toMatchObject({
      decision: {
        release: {
          metadata: {
            releasedAt: Date.parse("2026-09-02T09:15:00Z") + milliseconds,
          },
        },
      },
    });
  },
);

test("a malformed release date is refused, however leniently a date parser would read it", () => {
  for (const currentVersionReleaseDate of [
    "yesterday",
    "2026-02-31T00:00:00Z",
    "2026-09-02T24:00:00Z",
    // V8 answers NaN for these, and Hermes rolls each over to a date that exists.
    "2026-13-01T00:00:00Z",
    "2026-09-00T09:15:00Z",
    "2026-09-02T25:15:00Z",
    "2026-09-02T09:15:60Z",
    "2026-09-02",
    "2026",
    "12",
    "Not a date 5",
    "2026-09-02T09:15:00+02:00",
    "2026-09-02T09:15:00.1234Z",
  ]) {
    expect(() =>
      readLookupDocument(
        { results: [entry({ currentVersionReleaseDate })] },
        EXPECTED,
      ),
    ).toThrow("malformed release date");
  }
});

test.each([
  ["several entries", [entry(), entry({ version: "3.4.0" })]],
  ["another app", [entry({ trackId: 1 })]],
  ["another bundle", [entry({ bundleId: "com.example.other" })]],
  ["no version", [entry({ version: "" })]],
  ["a malformed release date", [entry({ currentVersionReleaseDate: "soon" })]],
])(
  "a lookup with %s is an invalid document, like a manifest that breaks its contract",
  (_name, results) => {
    expect(() => readLookupDocument({ results }, EXPECTED)).toThrow(
      expect.objectContaining({ code: "INVALID_DOCUMENT" }),
    );
  },
);
