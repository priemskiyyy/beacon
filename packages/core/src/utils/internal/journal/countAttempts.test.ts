import { expect, test } from "vitest";

import { buildIntent, buildStored } from "src/utils/journal.fixture";
import { countAttempts } from "src/utils/internal/journal/countAttempts";

test("a target never tried has no earlier attempts", () => {
  expect(countAttempts(buildIntent(), [])).toBe(0);
});

test("boots in a row that left the same target unreached are counted", () => {
  const history = [
    buildStored(buildIntent(), "target-not-running", 1),
    buildStored(buildIntent(), "target-not-running", 2),
  ];

  expect(countAttempts(buildIntent(), history)).toBe(2);
});

test("a boot that reached the target starts the count again", () => {
  const history = [
    buildStored(buildIntent(), "target-not-running", 1),
    buildStored(buildIntent(), "target-running", 0),
    buildStored(buildIntent(), "target-not-running", 1),
  ];

  expect(countAttempts(buildIntent(), history)).toBe(1);
});

test("a new decision names another target and is not charged for the old one", () => {
  const other = buildIntent({
    target: {
      status: "known",
      authority: "com.example.notes",
      domain: "web-artifact",
      value: "web-build-n",
    },
  });

  expect(
    countAttempts(other, [buildStored(buildIntent(), "target-not-running", 1)]),
  ).toBe(0);
});

test("another command or route is another attempt", () => {
  const history = [buildStored(buildIntent(), "target-not-running", 1)];

  expect(countAttempts(buildIntent({ command: "activate" }), history)).toBe(0);
  expect(countAttempts(buildIntent({ route: "ota" }), history)).toBe(0);
});

test("a target that is unknown can never be the same attempt", () => {
  const unknown = buildIntent({
    target: { status: "unknown", reason: "worker-build-unknown" },
  });

  expect(
    countAttempts(unknown, [buildStored(unknown, "target-not-running", 1)]),
  ).toBe(0);
});

test("intents with no target are the same attempt only with each other", () => {
  const none = buildIntent({ target: null });

  expect(
    countAttempts(none, [buildStored(none, "target-not-running", 1)]),
  ).toBe(1);
  expect(
    countAttempts(none, [buildStored(buildIntent(), "target-not-running", 1)]),
  ).toBe(0);
});
