import type { ReleaseIdentity } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { formatCell } from "src/formatting/formatCell";
import { formatCheck } from "src/formatting/formatCheck";
import { formatDateTime } from "src/formatting/formatDateTime";
import { formatEventText } from "src/formatting/formatEventText";
import { formatEventTime } from "src/formatting/formatEventTime";
import { formatExpiry } from "src/formatting/formatExpiry";
import { formatIdentity } from "src/formatting/formatIdentity";
import { formatIsoTime } from "src/formatting/formatIsoTime";
import { formatNative } from "src/formatting/formatNative";
import { formatOperation } from "src/formatting/formatOperation";
import { formatOptionalIdentity } from "src/formatting/formatOptionalIdentity";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import { formatPrepared } from "src/formatting/formatPrepared";
import { formatRaw } from "src/formatting/formatRaw";
import { formatRelease } from "src/formatting/formatRelease";
import { formatRevision } from "src/formatting/formatRevision";
import { formatStatus } from "src/formatting/formatStatus";
import { formatValueText } from "src/formatting/formatValueText";
import type { RecordedEvent } from "src/types/internal/RecordedEvent";

const known: ReleaseIdentity = {
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value: "web-build-a",
};

test("the session is written with its number only while it runs", () => {
  expect(formatStatus({ state: "idle" })).toBe("idle");
  expect(formatStatus({ state: "running", session: 3 })).toBe(
    "running, session 3",
  );
  expect(formatStatus({ state: "stopped" })).toBe("stopped");
  expect(formatStatus({ state: "disposed" })).toBe("disposed");
});

test("a check is written in a few words, with the code of a failure", () => {
  expect(formatCheck({ state: "idle" })).toBe("idle");
  expect(formatCheck({ state: "checking", attempt: 2, startedAt: 1 })).toBe(
    "checking, attempt 2",
  );
  expect(
    formatCheck({ state: "succeeded", attempt: 2, startedAt: 1, settledAt: 2 }),
  ).toBe("succeeded");
  expect(
    formatCheck({
      state: "failed",
      attempt: 2,
      startedAt: 1,
      settledAt: 2,
      error: { code: "SOURCE_TIMEOUT", message: "slow" },
    }),
  ).toBe("failed, SOURCE_TIMEOUT");
});

test("an operation is written with its command", () => {
  expect(formatOperation({ state: "idle" })).toBe("idle");
  expect(
    formatOperation({
      state: "running",
      operation: { id: 1 },
      command: "reload",
      progress: null,
    }),
  ).toBe("running reload");
  expect(
    formatOperation({
      state: "indeterminate",
      operation: { id: 1 },
      command: "reload",
      reason: "lost",
    }),
  ).toBe("indeterminate reload");
});

test("a prepared state is written with the identity of what is ready", () => {
  expect(formatPrepared({ status: "not-applicable" })).toBe("not-applicable");
  expect(formatPrepared({ status: "unknown" })).toBe("unknown");
  expect(formatPrepared({ status: "none", observedAt: 1 })).toBe("none");
  expect(
    formatPrepared({
      status: "ready",
      observedAt: 1,
      value: {
        ref: { kind: "prepared", route: "ota", id: 1 },
        release: { identity: known },
      },
    }),
  ).toBe("ready, web-build-a (com.example.notes, web-artifact)");
});

test("an identity is its value and who assigns it, or why it is unknown", () => {
  expect(formatIdentity(known)).toBe(
    "web-build-a (com.example.notes, web-artifact)",
  );
  expect(formatIdentity({ status: "unknown", reason: "not-reported" })).toBe(
    "unknown (not-reported)",
  );
  expect(formatIdentity({ ...known, value: "v".repeat(300) })).toContain(
    "… [Truncated]",
  );
  expect(formatOptionalIdentity(null, "not known")).toBe("not known");
  expect(formatOptionalIdentity(known, "not known")).toBe(
    formatIdentity(known),
  );
});

test("a release is its label and its identity, or none", () => {
  expect(formatRelease(null)).toBe("none");
  expect(formatRelease({ identity: known })).toBe(formatIdentity(known));
  expect(formatRelease({ identity: known, label: "Build a" })).toBe(
    `Build a, ${formatIdentity(known)}`,
  );
});

test("a revision is written by its kind, and none when the authority gave none", () => {
  expect(formatRevision(null)).toBe("none");
  expect(formatRevision({ kind: "opaque", value: "rev-1" })).toBe(
    "opaque rev-1",
  );
  expect(
    formatRevision({
      kind: "ordered",
      domain: "notes-web",
      epoch: "v1",
      value: "208",
    }),
  ).toBe("notes-web/v1 #208");
});

test("a text a fact may lack is bounded, or none", () => {
  expect(formatOptionalText(null)).toBe("none");
  expect(formatOptionalText(undefined)).toBe("none");
  expect(formatOptionalText("issuer")).toBe("issuer");
  expect(formatOptionalText("i".repeat(300))).toContain("… [Truncated]");
  expect(formatCell(null)).toBe("");
  expect(formatCell(0)).toBe("0");
  expect(formatCell("web")).toBe("web");
});

test("a time is written in local time, an expiry may be never, and a time a date cannot hold is said to be invalid", () => {
  expect(formatEventTime(1_700_000_000_123)).toMatch(/^\d\d:\d\d:\d\d[.,]123$/);
  expect(formatDateTime(1_700_000_000_000)).toMatch(/2023/);
  expect(formatExpiry(null)).toBe("never");
  expect(formatExpiry(1_700_000_000_000)).toBe(
    formatDateTime(1_700_000_000_000),
  );
  expect(formatIsoTime(1_700_000_000_123)).toBe("2023-11-14T22:13:20.123Z");

  for (const time of [Number.NaN, Number.POSITIVE_INFINITY, 1e20]) {
    expect(formatEventTime(time)).toBe("invalid time");
    expect(formatDateTime(time)).toBe("invalid time");
    expect(formatIsoTime(time)).toBe("invalid time");
  }
});

test("a value's text is indented JSON cut off after 12k characters", () => {
  expect(formatValueText({ a: 1 })).toBe('{\n  "a": 1\n}');
  expect(formatValueText(undefined)).toBe("undefined");

  const long = formatValueText({ text: "x".repeat(20_000) });

  expect(long.length).toBeLessThan(12_020);
  expect(long.endsWith("… [Truncated]")).toBe(true);
});

test("raw values and a native handle are text with secret-named properties replaced", () => {
  expect(
    formatRaw({ build: 1, token: "secret", enabled: true, none: null }),
  ).toBe(
    JSON.stringify(
      { build: 1, token: "[Redacted]", enabled: true, none: null },
      null,
      2,
    ),
  );
  expect(formatNative(null)).toBe("[No open session holds a handle]");
  expect(formatNative({ label: "provider", password: "secret" })).toBe(
    JSON.stringify({ label: "provider", password: "[Redacted]" }, null, 2),
  );
});

test("an event's text has every field it declares and the time in UTC", () => {
  const event: RecordedEvent = {
    id: 9,
    type: "command-settled",
    timestamp: 1_700_000_000_123,
    session: 1,
    route: "web",
    command: "reload",
    attempt: 2,
    operation: 3,
    reason: null,
    failure: false,
  };

  expect(JSON.parse(formatEventText(event))).toEqual({
    type: "command-settled",
    time: "2023-11-14T22:13:20.123Z",
    session: 1,
    route: "web",
    command: "reload",
    attempt: 2,
    operation: 3,
    reason: null,
  });
});
