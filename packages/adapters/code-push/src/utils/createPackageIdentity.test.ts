import { expect, test } from "vitest";

import { HASH_A } from "src/fakeCodePush.fixture";
import { createPackageIdentity } from "src/utils/createPackageIdentity";

test("a package is named by the hash of its release, as CodePush wrote it", () => {
  expect(createPackageIdentity(HASH_A)).toEqual({
    status: "known",
    authority: "code-push",
    domain: "package-hash",
    value: HASH_A,
  });
  expect(createPackageIdentity(HASH_A.toUpperCase())).toMatchObject({
    value: HASH_A.toUpperCase(),
  });
});

test("a hash that is empty, blank or missing names nothing, and is never the text undefined or empty", () => {
  // What a server's answer can carry, though the type says a hash is there.
  const omitted: { packageHash: string } = JSON.parse("{}");

  for (const hash of ["", "  ", "\n", omitted.packageHash]) {
    expect(createPackageIdentity(hash)).toEqual({
      status: "unknown",
      reason: "package-hash-missing",
    });
  }
});
