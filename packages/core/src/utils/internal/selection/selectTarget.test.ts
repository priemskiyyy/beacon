import { expect, test } from "vitest";

import type { NoneDecision } from "src/types/NoneDecision";
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
    candidate: decision.release,
  });
});

test("a target of another domain is inconclusive even when the strings match", () => {
  const decision: TargetDecision = {
    kind: "target",
    release: { identity: buildIdentity("web-build-b", "expo-update") },
  };

  expect(selectTarget({ decision, running: buildRunning() })).toMatchObject({
    status: "inconclusive",
    reason: "incomparable-identity",
  });
});

test("an unknown running identity is inconclusive, never a difference", () => {
  const decision = target("web-build-a");

  expect(
    selectTarget({ decision, running: buildRunning(UNKNOWN_IDENTITY) }),
  ).toMatchObject({
    status: "inconclusive",
    reason: "missing-current-identity",
  });
  expect(selectTarget({ decision, running: null })).toMatchObject({
    status: "inconclusive",
    reason: "missing-current-identity",
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
