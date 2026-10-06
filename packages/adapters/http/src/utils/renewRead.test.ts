import { expect, test } from "vitest";

import { renewRead } from "src/utils/renewRead";

test("renewRead gives the same answer a new expiry", () => {
  const held = { document: "manifest", digest: "a", expiresAt: 100 };

  expect(renewRead(held, 200)).toEqual({ ...held, expiresAt: 200 });
});

test("renewRead without an expiry keeps the answer as it was", () => {
  const held = { document: "manifest", expiresAt: 100 };

  expect(renewRead(held, undefined)).toBe(held);
});
