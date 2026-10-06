import { expect, test } from "vitest";

import { APP_ID, BUNDLE_ID, entry } from "src/fakeStore.fixture";
import { readLookupEntry } from "src/utils/readLookupEntry";

const EXPECTED = { appId: APP_ID, bundleId: BUNDLE_ID };

test("STORE-01 a matching entry is a candidate marketing version, bound to the configured app", () => {
  expect(readLookupEntry({ results: [entry()] }, EXPECTED)).toEqual({
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

test("STORE-02 no entry is nothing matched in that lookup context, not proof that no update exists", () => {
  expect(readLookupEntry({ results: [] }, EXPECTED)).toEqual({
    decision: { kind: "none", reason: "no-match" },
  });
});

test("STORE-03 several entries for one app are refused, not resolved by guessing", () => {
  expect(() =>
    readLookupEntry(
      { results: [entry(), entry({ version: "3.4.0" })] },
      EXPECTED,
    ),
  ).toThrow("several entries");
});

test("STORE-04 an entry of another app is refused", () => {
  expect(() =>
    readLookupEntry({ results: [entry({ trackId: 1 })] }, EXPECTED),
  ).toThrow("another app id");
});

test("STORE-05 an entry of another bundle is refused, and the bundle is checked only when configured", () => {
  const other = entry({ bundleId: "com.example.other" });

  expect(() => readLookupEntry({ results: [other] }, EXPECTED)).toThrow(
    "another bundle id",
  );
  expect(
    readLookupEntry(
      { results: [other] },
      { appId: APP_ID, bundleId: undefined },
    ),
  ).toMatchObject({ decision: { kind: "candidate" } });
});

test("STORE-06 an entry with no version is refused", () => {
  expect(() =>
    readLookupEntry({ results: [entry({ version: "" })] }, EXPECTED),
  ).toThrow("no version");
});

test("STORE-07 a malformed release date is refused", () => {
  expect(() =>
    readLookupEntry(
      { results: [entry({ currentVersionReleaseDate: "yesterday" })] },
      EXPECTED,
    ),
  ).toThrow("malformed release date");
});

test("a refusal is a source failure", () => {
  expect(() =>
    readLookupEntry({ results: [entry({ version: "" })] }, EXPECTED),
  ).toThrow(expect.objectContaining({ code: "SOURCE_FAILED" }));
});
