import { expect, test } from "vitest";

import { appleMarketingVersion } from "src/appleMarketingVersion";

test("the marketing version is the short version fact of the running native release", () => {
  expect(
    appleMarketingVersion({
      identity: { status: "unknown", reason: "native" },
      label: null,
      raw: { shortVersion: "3.2.1", build: "412" },
    }),
  ).toBe("3.2.1");
});

test("STORE-04 without the short version, or a release, the order of what runs is unknown", () => {
  expect(
    appleMarketingVersion({
      identity: { status: "unknown", reason: "native" },
      label: null,
      raw: { build: "412", shortVersion: 3 },
    }),
  ).toBeNull();
  expect(appleMarketingVersion(null)).toBeNull();
});
