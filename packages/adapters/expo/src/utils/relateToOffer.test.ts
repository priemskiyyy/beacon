import { expect, test } from "vitest";

import { UPDATE_A, UPDATE_B } from "src/fakeUpdates.fixture";
import { createRollbackIdentity } from "src/utils/createRollbackIdentity";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";
import { relateToOffer } from "src/utils/relateToOffer";

test("the same id is the same update, another id another, and an unnamed target is not comparable", () => {
  const a = createUpdateIdentity(UPDATE_A);

  expect(relateToOffer(a, createUpdateIdentity(UPDATE_A))).toBe("same");
  expect(relateToOffer(a, createUpdateIdentity(UPDATE_B))).toBe("different");
  expect(relateToOffer(a, createRollbackIdentity())).toBe("unknown");
  expect(relateToOffer(createRollbackIdentity(), a)).toBe("unknown");
});
