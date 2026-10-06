import { expect, test } from "vitest";

import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import { compareIdentities } from "src/utils/compareIdentities";

type KnownIdentity = Extract<ReleaseIdentity, { status: "known" }>;

const build = (value: string): KnownIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value,
});

test("VER-01 the same value in another authority is incomparable", () => {
  const other = { ...build("a"), authority: "com.other" };

  expect(compareIdentities(build("a"), other)).toBe("incomparable");
});

test("VER-01 the same value in another domain is incomparable", () => {
  const other = { ...build("a"), domain: "expo-update" };

  expect(compareIdentities(build("a"), other)).toBe("incomparable");
});

test("CORE-13 an unknown identity is never the same as another unknown one", () => {
  const unknown: ReleaseIdentity = { status: "unknown", reason: "embedded" };

  expect(compareIdentities(unknown, unknown)).toBe("incomparable");
  expect(compareIdentities(unknown, { ...unknown })).toBe("incomparable");
});

test("an unknown identity is incomparable with a known one on either side", () => {
  const unknown: ReleaseIdentity = { status: "unknown", reason: "embedded" };

  expect(compareIdentities(unknown, build("a"))).toBe("incomparable");
  expect(compareIdentities(build("a"), unknown)).toBe("incomparable");
});

test("identities of one authority and domain are the same or different by value", () => {
  expect(compareIdentities(build("a"), build("a"))).toBe("same");
  expect(compareIdentities(build("a"), build("b"))).toBe("different");
});
