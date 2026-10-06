import { expect, test } from "vitest";

import type { CandidateDecision } from "src/types/CandidateDecision";
import { BeaconError } from "src/utils/BeaconError";
import {
  UNKNOWN_IDENTITY,
  buildIdentity,
  buildRunning,
} from "src/utils/internal/selection/selection.fixture";
import { selectNewer } from "src/utils/internal/selection/selectNewer";
import { custom } from "src/utils/versions/custom";
import { semver } from "src/utils/versions/semver";

const candidate = (
  order: string,
  value = "web-build-a",
): CandidateDecision<string> => ({
  kind: "candidate",
  release: { identity: buildIdentity(value), order },
});

const select = (
  order: string,
  currentOrder: string | null = "2.3.0",
  value = "web-build-a",
) =>
  selectNewer({
    decision: candidate(order, value),
    running: buildRunning(),
    currentOrder,
    version: semver(),
  });

test("a candidate that orders newer than what is running is an offer", () => {
  expect(select("2.4.0")).toMatchObject({ status: "offer" });
});

test("VER-02 an equal order with a different identity is not an upgrade and says so", () => {
  expect(select("2.3.0")).toMatchObject({
    status: "none",
    reason: "equal-order-different-identity",
  });
});

test("an equal order with the running identity has nothing to offer", () => {
  expect(select("2.3.0", "2.3.0", "web-build-b")).toMatchObject({
    status: "none",
    reason: "equal-order",
  });
});

test("a candidate that orders lower is explained, not offered", () => {
  expect(select("2.2.0")).toMatchObject({
    status: "none",
    reason: "older-than-current",
  });
});

test("VER-04 a prerelease is not admitted even when it orders newer", () => {
  expect(select("2.4.0-rc.1")).toMatchObject({
    status: "none",
    reason: "not-admitted",
  });
});

test("an unknown current order is inconclusive, never version zero", () => {
  expect(select("2.4.0", null)).toMatchObject({
    status: "inconclusive",
    reason: "missing-current-order",
  });
});

test("VER-10 a comparator that says incomparable makes the selection inconclusive", () => {
  const version = custom({
    name: "trains",
    parse: (input: string) => input,
    compare: () => "incomparable",
  });

  expect(
    selectNewer({
      decision: candidate("beta:9"),
      running: buildRunning(),
      currentOrder: "stable:2",
      version,
    }),
  ).toMatchObject({ status: "inconclusive", reason: "incomparable-order" });
});

test("VER-11 a comparator that throws fails the selection with the cause kept", () => {
  const cause = new Error("The comparator threw.");

  const version = custom({
    name: "trains",
    parse: (input: string) => input,
    compare: () => {
      throw cause;
    },
  });

  expect(() =>
    selectNewer({
      decision: candidate("beta:9"),
      running: buildRunning(),
      currentOrder: "stable:2",
      version,
    }),
  ).toThrow(expect.objectContaining({ code: "SELECTION_FAILED", cause }));
});

test("VER-11 a parser that throws a beacon error keeps its own code", () => {
  expect(() => select("not-a-version")).toThrow(
    expect.objectContaining({ code: "INVALID_VERSION" }),
  );
  expect(() => select("2.4.0", "v2")).toThrow(BeaconError);
});

test("VER-17 a candidate with the running identity but another order is a conflict", () => {
  expect(() => select("2.4.0", "2.3.0", "web-build-b")).toThrow(
    expect.objectContaining({ code: "IDENTITY_CONFLICT" }),
  );
});

test("an unknown running identity leaves an equal order unexplained by identity", () => {
  expect(
    selectNewer({
      decision: candidate("2.3.0"),
      running: buildRunning(UNKNOWN_IDENTITY),
      currentOrder: "2.3.0",
      version: semver(),
    }),
  ).toMatchObject({ status: "none", reason: "equal-order" });
});

test("an incompatible candidate is not offered and stays visible", () => {
  const decision: CandidateDecision<string> = {
    kind: "candidate",
    release: {
      identity: buildIdentity("web-build-a"),
      order: "2.4.0",
      compatibility: { status: "incompatible", reasons: ["runtime"] },
    },
  };

  expect(
    selectNewer({
      decision,
      running: buildRunning(),
      currentOrder: "2.3.0",
      version: semver(),
    }),
  ).toEqual({
    status: "none",
    reason: "incompatible",
    detail: null,
    candidate: decision.release,
  });
});

test("an explicit no-decision keeps the authority's reason", () => {
  expect(
    selectNewer({
      decision: { kind: "none", reason: "up-to-date" },
      running: buildRunning(),
      currentOrder: "2.3.0",
      version: semver(),
    }),
  ).toEqual({
    status: "none",
    reason: "no-decision",
    detail: "up-to-date",
    candidate: null,
  });
});
