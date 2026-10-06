import { expect, test } from "vitest";

import { describeImpacts } from "src/utils/internal/commands/describeImpacts";

test("a command with no impact is neither disruptive nor realm replacing", () => {
  expect(describeImpacts([])).toEqual({
    disruptive: false,
    replacesRealm: false,
  });
});

test("preparing for the next start disrupts nothing that is running", () => {
  expect(describeImpacts(["may-activate-on-next-start"])).toEqual({
    disruptive: false,
    replacesRealm: false,
  });
});

test("a native flow takes the disruptive slot without replacing the realm", () => {
  expect(describeImpacts(["native-update-flow"])).toEqual({
    disruptive: true,
    replacesRealm: false,
  });
});

test("a reload replaces the realm", () => {
  expect(describeImpacts(["document-replacement"])).toEqual({
    disruptive: true,
    replacesRealm: true,
  });
});
