import type { ReleaseIdentity } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { UPDATE_A, UPDATE_B } from "src/fakeUpdates.fixture";
import { ROLLBACK_IDENTITY } from "src/utils/constants/identities";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";
import { relateToOffer } from "src/utils/relateToOffer";

test("the same id is the same update, another id another, and an unnamed target is not comparable", () => {
  const a = createUpdateIdentity(UPDATE_A);

  expect(relateToOffer(a, createUpdateIdentity(UPDATE_A))).toBe("same");
  expect(relateToOffer(a, createUpdateIdentity(UPDATE_B))).toBe("different");
  expect(relateToOffer(a, ROLLBACK_IDENTITY)).toBe("unknown");
  expect(relateToOffer(ROLLBACK_IDENTITY, a)).toBe("unknown");
});

test("an identity of another authority is not comparable, whatever its value", () => {
  const foreign: ReleaseIdentity = {
    status: "known",
    authority: "com.example.other",
    domain: "update",
    value: UPDATE_A,
  };

  expect(relateToOffer(createUpdateIdentity(UPDATE_A), foreign)).toBe(
    "unknown",
  );
});
