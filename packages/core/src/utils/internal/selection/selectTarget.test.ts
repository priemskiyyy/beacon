import { expect, test } from "vitest";

import type { NoneDecision } from "src/types/NoneDecision";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { TargetDecision } from "src/types/TargetDecision";
import {
  UNKNOWN_IDENTITY,
  buildIdentity,
  buildRunning,
} from "src/utils/internal/selection/selection.fixture";
import { selectTarget } from "src/utils/internal/selection/selectTarget";

const target = (value: string): TargetDecision => ({
  kind: "target",
  release: { identity: buildIdentity(value) },
});

test("VER-12 a target with a different comparable identity is an offer whatever its order", () => {
  const decision = target("web-build-a");

  expect(selectTarget({ decision, running: buildRunning() })).toEqual({
    status: "offer",
    release: decision.release,
  });
});

test("a target that is already running has nothing to offer", () => {
  const decision = target("web-build-b");

  expect(selectTarget({ decision, running: buildRunning() })).toEqual({
    status: "none",
    reason: "same-identity",
    detail: null,
    candidate: decision.release,
  });
});

test("an unknown target identity is inconclusive, never a difference", () => {
  const decision: TargetDecision = {
    kind: "target",
    release: { identity: UNKNOWN_IDENTITY },
  };

  expect(selectTarget({ decision, running: buildRunning() })).toEqual({
    status: "inconclusive",
    reason: "incomparable-identity",
    detail: "offered identity unknown: not-reported",
    candidate: decision.release,
  });
});

test("a target of another domain is inconclusive even when the strings match, and says which side differs", () => {
  const decision: TargetDecision = {
    kind: "target",
    release: { identity: buildIdentity("web-build-b", "expo-update") },
  };

  expect(selectTarget({ decision, running: buildRunning() })).toMatchObject({
    status: "inconclusive",
    reason: "incomparable-identity",
    detail: "domain: running web-artifact, offered expo-update",
  });
});

test("a target of another authority says so, and one that differs in both names both", () => {
  const other: ReleaseIdentity = {
    status: "known",
    authority: "com.example.shop",
    domain: "web-artifact",
    value: "web-build-b",
  };

  expect(
    selectTarget({
      decision: { kind: "target", release: { identity: other } },
      running: buildRunning(),
    }),
  ).toMatchObject({
    reason: "incomparable-identity",
    detail: "authority: running com.example.notes, offered com.example.shop",
  });
  expect(
    selectTarget({
      decision: {
        kind: "target",
        release: { identity: { ...other, domain: "expo-update" } },
      },
      running: buildRunning(),
    }),
  ).toMatchObject({
    reason: "incomparable-identity",
    detail:
      "authority: running com.example.notes, offered com.example.shop; domain: running web-artifact, offered expo-update",
  });
});

test("an unknown running identity is inconclusive, never a difference", () => {
  const decision = target("web-build-a");

  expect(
    selectTarget({ decision, running: buildRunning(UNKNOWN_IDENTITY) }),
  ).toMatchObject({
    status: "inconclusive",
    reason: "missing-current-identity",
    detail: "not-reported",
  });
  expect(
    selectTarget({ decision, running: null, missing: "running-pending" }),
  ).toMatchObject({
    status: "inconclusive",
    reason: "missing-current-identity",
    detail: "running-pending",
  });
});

test("an incompatible target is not offered and stays visible as the candidate", () => {
  const decision: TargetDecision = {
    kind: "target",
    release: {
      identity: buildIdentity("web-build-a"),
      compatibility: { status: "incompatible", reasons: ["runtime-version"] },
    },
  };

  expect(selectTarget({ decision, running: buildRunning() })).toEqual({
    status: "none",
    reason: "incompatible",
    detail: null,
    candidate: decision.release,
  });
});

test("a target whose compatibility is unknown is still offered", () => {
  const decision: TargetDecision = {
    kind: "target",
    release: {
      identity: buildIdentity("web-build-a"),
      compatibility: { status: "unknown", reason: "not-checked" },
    },
  };

  expect(selectTarget({ decision, running: buildRunning() }).status).toBe(
    "offer",
  );
});

test("an explicit no-decision keeps the authority's reason", () => {
  const decision: NoneDecision = { kind: "none", reason: "up-to-date" };

  expect(selectTarget({ decision, running: buildRunning() })).toEqual({
    status: "none",
    reason: "no-decision",
    detail: "up-to-date",
    candidate: null,
  });
});
