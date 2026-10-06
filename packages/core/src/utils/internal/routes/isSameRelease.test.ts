import { expect, test } from "vitest";

import type { Release } from "src/types/Release";
import { isSameRelease } from "src/utils/internal/routes/isSameRelease";

const known = (value: string, label = "x"): Release => ({
  identity: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value,
  },
  label,
});

test("VER-15 a known identity is the same release whatever its refreshed label", () => {
  expect(isSameRelease(known("a", "one"), known("a", "two"))).toBe(true);
  expect(isSameRelease(known("a"), known("b"))).toBe(false);
});

test("an unknown identity is the same only with the same data", () => {
  const unknown: Release = {
    identity: { status: "unknown", reason: "embedded" },
    label: "x",
  };

  expect(isSameRelease(unknown, { ...unknown })).toBe(true);
  expect(isSameRelease(unknown, { ...unknown, label: "y" })).toBe(false);
  expect(isSameRelease(unknown, known("a"))).toBe(false);
});
