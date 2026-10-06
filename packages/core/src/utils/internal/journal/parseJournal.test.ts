import { expect, test } from "vitest";

import { buildIntent, buildStored } from "src/utils/journal.fixture";
import { parseJournal } from "src/utils/internal/journal/parseJournal";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";

test("a record reads back as it was written", () => {
  const transitions = [
    buildStored(buildIntent()),
    buildStored(
      buildIntent({ target: null, current: null }),
      "inconclusive",
      0,
    ),
  ];

  expect(parseJournal(serializeJournal(transitions))).toEqual(transitions);
});

test("text that is not JSON is ignored", () => {
  expect(parseJournal("{oops")).toBeUndefined();
});

test("a record of another version is ignored", () => {
  expect(
    parseJournal(JSON.stringify({ version: 2, transitions: [] })),
  ).toBeUndefined();
});

test("a record with no list of transitions is ignored", () => {
  expect(parseJournal(JSON.stringify({ version: 1 }))).toBeUndefined();
  expect(
    parseJournal(JSON.stringify({ version: 1, transitions: {} })),
  ).toBeUndefined();
  expect(parseJournal("null")).toBeUndefined();
  expect(parseJournal("7")).toBeUndefined();
});

test("a record with one bad transition is ignored whole, not half trusted", () => {
  const good = buildStored(buildIntent());
  const bad = { ...good, attempts: -1 };

  expect(
    parseJournal(JSON.stringify({ version: 1, transitions: [good, bad] })),
  ).toBeUndefined();
});

test("each field is checked: a wrong type anywhere is a bad transition", () => {
  const good = buildStored(buildIntent());

  const broken = [
    { ...good, intent: { ...good.intent, route: 3 } },
    { ...good, intent: { ...good.intent, subject: "kernel" } },
    { ...good, intent: { ...good.intent, binding: "anything" } },
    { ...good, intent: { ...good.intent, createdAt: "yesterday" } },
    { ...good, intent: { ...good.intent, operation: { id: 1.5 } } },
    { ...good, intent: { ...good.intent, target: { status: "known" } } },
    { ...good, intent: { ...good.intent, current: { status: "maybe" } } },
    { ...good, outcome: "success" },
    { ...good, attempts: "many" },
  ];

  for (const transition of broken) {
    expect(
      parseJournal(JSON.stringify({ version: 1, transitions: [transition] })),
    ).toBeUndefined();
  }
});

test("a record with more transitions than the capacity is ignored", () => {
  const transitions = Array.from({ length: 9 }, () =>
    buildStored(buildIntent()),
  );

  expect(
    parseJournal(JSON.stringify({ version: 1, transitions })),
  ).toBeUndefined();
});

test("a record larger than any record can be is ignored without being parsed", () => {
  expect(parseJournal(" ".repeat(70_000))).toBeUndefined();
});
