import { expect, test } from "vitest";

import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { TransitionIntent } from "src/types/TransitionIntent";
import { countAttempts } from "src/utils/internal/journal/countAttempts";
import { buildIntent, buildStored } from "src/utils/journal.fixture";

// The intent of a boot that ran before the one being judged, which is boot-9.
const current = (overrides: Partial<TransitionIntent> = {}) =>
  buildIntent({ boot: { id: "boot-9" }, ...overrides });

const earlier = (
  boot: string,
  outcome: StoredTransition["outcome"],
  overrides: Partial<TransitionIntent> = {},
) => buildStored(buildIntent({ boot: { id: boot }, ...overrides }), outcome, 1);

test("a target never tried has no earlier attempts", () => {
  expect(countAttempts(current(), [])).toBe(0);
});

test("boots in a row that left the same target unreached are counted", () => {
  const history = [
    earlier("boot-1", "target-not-running"),
    earlier("boot-2", "target-not-running"),
  ];

  expect(countAttempts(current(), history)).toBe(2);
});

test("several intents of one boot are one boot", () => {
  const history = [
    earlier("boot-1", "target-not-running"),
    earlier("boot-1", "target-not-running"),
    earlier("boot-1", "target-not-running"),
  ];

  expect(countAttempts(current(), history)).toBe(1);
});

test("an intent of the boot being judged is not an earlier boot", () => {
  const history = [
    earlier("boot-1", "target-not-running"),
    earlier("boot-9", "target-not-running"),
  ];

  expect(countAttempts(current(), history)).toBe(1);
});

test("a boot that reached the target starts the count again", () => {
  const history = [
    earlier("boot-1", "target-not-running"),
    earlier("boot-2", "target-running"),
    earlier("boot-3", "target-not-running"),
  ];

  expect(countAttempts(current(), history)).toBe(1);
});

test("a new decision names another target and is not charged for the old one", () => {
  const other = current({
    target: {
      status: "known",
      authority: "com.example.notes",
      domain: "web-artifact",
      value: "web-build-n",
    },
  });

  expect(countAttempts(other, [earlier("boot-1", "target-not-running")])).toBe(
    0,
  );
});

test("another command or route is another attempt", () => {
  const history = [earlier("boot-1", "target-not-running")];

  expect(countAttempts(current({ command: "activate" }), history)).toBe(0);
  expect(countAttempts(current({ route: "ota" }), history)).toBe(0);
});

test("a target that is unknown can never be the same attempt", () => {
  const unknown = {
    target: { status: "unknown", reason: "worker-build-unknown" },
  } satisfies Partial<TransitionIntent>;

  expect(
    countAttempts(current(unknown), [
      earlier("boot-1", "target-not-running", unknown),
    ]),
  ).toBe(0);
});

test("intents with no target are the same attempt only with each other", () => {
  const none = { target: null };

  expect(
    countAttempts(current(none), [
      earlier("boot-1", "target-not-running", none),
    ]),
  ).toBe(1);
  expect(
    countAttempts(current(none), [earlier("boot-1", "target-not-running")]),
  ).toBe(0);
});
