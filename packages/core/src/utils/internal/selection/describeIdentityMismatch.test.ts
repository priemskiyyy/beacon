import { expect, test } from "vitest";

import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import { describeIdentityMismatch } from "src/utils/internal/selection/describeIdentityMismatch";
import {
  UNKNOWN_IDENTITY,
  buildIdentity,
} from "src/utils/internal/selection/selection.fixture";

const other: ReleaseIdentity = {
  status: "known",
  authority: "com.example.shop",
  domain: "expo-update",
  value: "update-1",
};

test("an identity that is unknown is named with the reason it gave, the running one first", () => {
  expect(describeIdentityMismatch(UNKNOWN_IDENTITY, buildIdentity("a"))).toBe(
    "running identity unknown: not-reported",
  );
  expect(describeIdentityMismatch(buildIdentity("a"), UNKNOWN_IDENTITY)).toBe(
    "offered identity unknown: not-reported",
  );
  expect(describeIdentityMismatch(UNKNOWN_IDENTITY, UNKNOWN_IDENTITY)).toBe(
    "running identity unknown: not-reported",
  );
});

test("the authority and the domain that differ are named with both words, and only those", () => {
  expect(describeIdentityMismatch(buildIdentity("a"), other)).toBe(
    "authority: running com.example.notes, offered com.example.shop; domain: running web-artifact, offered expo-update",
  );
  expect(
    describeIdentityMismatch(buildIdentity("a"), {
      ...other,
      domain: "web-artifact",
    }),
  ).toBe("authority: running com.example.notes, offered com.example.shop");
  expect(
    describeIdentityMismatch(buildIdentity("a"), {
      ...other,
      authority: "com.example.notes",
    }),
  ).toBe("domain: running web-artifact, offered expo-update");
});
