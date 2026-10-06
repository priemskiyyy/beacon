import { expect, test } from "vitest";

import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningFact } from "src/types/RunningFact";
import { buildIntent } from "src/utils/journal.fixture";
import { reconcileIntent } from "src/utils/internal/journal/reconcileIntent";

const running = (web: RunningFact, boot = "boot-2"): RunningApplication => ({
  boot: { id: boot },
  revision: 1,
  native: { state: "unconfigured" },
  bundle: { state: "unconfigured" },
  web,
  worker: { state: "unconfigured" },
});

const known = (value: string): RunningFact => ({
  state: "known",
  readAt: 1,
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "web-artifact",
      value,
    },
    label: null,
    raw: {},
  },
});

test("the same boot has observed nothing new", () => {
  expect(
    reconcileIntent(buildIntent(), running(known("web-build-a"), "boot-1")),
  ).toBe("same-boot");
});

test("a new boot that runs the target has reached it", () => {
  expect(reconcileIntent(buildIntent(), running(known("web-build-a")))).toBe(
    "target-running",
  );
});

test("a new boot that runs what ran before has not reached the target", () => {
  expect(reconcileIntent(buildIntent(), running(known("web-build-b")))).toBe(
    "target-not-running",
  );
});

test("a new boot that runs another build than either is a different target", () => {
  expect(reconcileIntent(buildIntent(), running(known("web-build-z")))).toBe(
    "different-target",
  );
});

test("a subject that is not known is inconclusive, never a failure", () => {
  expect(reconcileIntent(buildIntent(), running({ state: "pending" }))).toBe(
    "inconclusive",
  );
});

test("an intent with no target names nothing to reach, so a change is inconclusive", () => {
  expect(
    reconcileIntent(
      buildIntent({ target: null }),
      running(known("web-build-z")),
    ),
  ).toBe("inconclusive");
});

test("an unknown target is never matched, whatever runs", () => {
  const unknown: ReleaseIdentity = {
    status: "unknown",
    reason: "worker-build-unknown",
  };

  expect(
    reconcileIntent(
      buildIntent({ target: unknown }),
      running(known("web-build-z")),
    ),
  ).toBe("inconclusive");
});

test("an identity of another domain matches nothing, even with the same value", () => {
  expect(
    reconcileIntent(
      buildIntent({
        target: {
          status: "known",
          authority: "com.example.notes",
          domain: "android-version-code",
          value: "web-build-a",
        },
      }),
      running(known("web-build-a")),
    ),
  ).toBe("inconclusive");
});
