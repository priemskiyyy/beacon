import { expect, test } from "vitest";

import type { DecisionRevision } from "src/types/DecisionRevision";
import type { RevisionClaim } from "src/types/internal/RevisionClaim";
import { judgeRevision } from "src/utils/internal/revisions/judgeRevision";

const ordered = (
  value: string,
  digest: string | null = "a",
  epoch = "production-v1",
  domain = "notes-web-deployments",
): RevisionClaim => {
  const revision: DecisionRevision = { kind: "ordered", domain, epoch, value };

  return { revision, digest };
};

const opaque = (value: string, digest: string | null = "a"): RevisionClaim => ({
  revision: { kind: "opaque", value },
  digest,
});

test("the first decision is accepted", () => {
  expect(judgeRevision(null, ordered("208"))).toEqual({ status: "accepted" });
  expect(judgeRevision({ revision: null, digest: null }, ordered("1"))).toEqual(
    {
      status: "accepted",
    },
  );
});

test("an ordered revision that advances is accepted, sizes beyond the safe range included", () => {
  expect(judgeRevision(ordered("208"), ordered("209"))).toEqual({
    status: "accepted",
  });
  expect(judgeRevision(ordered("99"), ordered("100"))).toEqual({
    status: "accepted",
  });
  expect(
    judgeRevision(ordered("9007199254740992"), ordered("9007199254740993")),
  ).toEqual({ status: "accepted" });
});

test("VER-13 a lower ordered revision in the same domain and epoch is a regression", () => {
  expect(judgeRevision(ordered("208"), ordered("207"))).toEqual({
    status: "rejected",
    code: "REVISION_REGRESSION",
  });
  expect(judgeRevision(ordered("100"), ordered("99"))).toEqual({
    status: "rejected",
    code: "REVISION_REGRESSION",
  });
});

test("VER-14 the same revision with different content is a conflict", () => {
  expect(judgeRevision(ordered("208", "a"), ordered("208", "b"))).toEqual({
    status: "rejected",
    code: "REVISION_CONFLICT",
  });
  expect(
    judgeRevision(opaque("policy-43", "a"), opaque("policy-43", "b")),
  ).toEqual({
    status: "rejected",
    code: "REVISION_CONFLICT",
  });
});

test("VER-15 the same revision with the same content only renews", () => {
  expect(judgeRevision(ordered("208", "a"), ordered("208", "a"))).toEqual({
    status: "renewed",
  });
  expect(
    judgeRevision(opaque("policy-43", "a"), opaque("policy-43", "a")),
  ).toEqual({
    status: "renewed",
  });
});

test("the same revision without a digest on either side cannot be told apart and renews", () => {
  expect(judgeRevision(ordered("208", null), ordered("208", "b"))).toEqual({
    status: "renewed",
  });
  expect(judgeRevision(ordered("208", "a"), ordered("208", null))).toEqual({
    status: "renewed",
  });
});

test("VER-16 another epoch or domain is never assumed to be newer", () => {
  expect(
    judgeRevision(ordered("208"), ordered("1", "a", "production-v2")),
  ).toEqual({
    status: "rejected",
    code: "REVISION_EPOCH_CHANGED",
  });
  expect(
    judgeRevision(
      ordered("208"),
      ordered("999", "a", "production-v1", "other"),
    ),
  ).toEqual({ status: "rejected", code: "REVISION_EPOCH_CHANGED" });
  expect(judgeRevision(ordered("208"), opaque("policy-43"))).toEqual({
    status: "rejected",
    code: "REVISION_EPOCH_CHANGED",
  });
});

test("an opaque revision that differs is accepted as a difference, not as chronology", () => {
  expect(judgeRevision(opaque("policy-43"), opaque("policy-2"))).toEqual({
    status: "accepted",
  });
});

test("an unversioned decision cannot replace a versioned one", () => {
  expect(
    judgeRevision(ordered("208"), { revision: null, digest: null }),
  ).toEqual({
    status: "rejected",
    code: "REVISION_REGRESSION",
  });
});
