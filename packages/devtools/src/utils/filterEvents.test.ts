import { expect, test } from "vitest";

import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { filterEvents } from "src/utils/filterEvents";

const record = (id: number, patch: Partial<RecordedEvent>): RecordedEvent => ({
  id,
  type: "session-started",
  timestamp: 1_000,
  session: null,
  route: null,
  command: null,
  attempt: null,
  operation: null,
  reason: null,
  failure: false,
  ...patch,
});

const events = [
  record(1, { type: "session-started", session: 1 }),
  record(2, {
    type: "check-requested",
    route: "web",
    session: 1,
    reason: "Manual",
  }),
  record(3, {
    type: "command-admitted",
    route: "ota",
    command: "download",
    attempt: 2,
    operation: 9,
  }),
  record(4, {
    type: "route-failed",
    route: "web",
    reason: "SOURCE_FAILED",
    failure: true,
  }),
];

const ids = (found: RecordedEvent[]) => found.map((entry) => entry.id);
const none = { route: null, query: "", type: null };

test("no filter keeps every event in its order", () => {
  expect(ids(filterEvents(events, none))).toEqual([1, 2, 3, 4]);
});

test("a type keeps only that type", () => {
  expect(ids(filterEvents(events, { ...none, type: "route-failed" }))).toEqual([
    4,
  ]);
  expect(ids(filterEvents(events, { ...none, type: "read-failed" }))).toEqual(
    [],
  );
});

test("a route keeps its events and those of no route, and drops another route's", () => {
  expect(ids(filterEvents(events, { ...none, route: "web" }))).toEqual([
    1, 2, 4,
  ]);
  expect(ids(filterEvents(events, { ...none, route: "ota" }))).toEqual([1, 3]);
  expect(ids(filterEvents(events, { ...none, route: "gone" }))).toEqual([1]);
});

test("a search matches any field, ignoring case and the spaces around it", () => {
  expect(ids(filterEvents(events, { ...none, query: "  manual " }))).toEqual([
    2,
  ]);
  expect(ids(filterEvents(events, { ...none, query: "DOWNLOAD" }))).toEqual([
    3,
  ]);
  expect(ids(filterEvents(events, { ...none, query: "session 1" }))).toEqual([
    1, 2,
  ]);
  expect(ids(filterEvents(events, { ...none, query: "attempt 2" }))).toEqual([
    3,
  ]);
  expect(ids(filterEvents(events, { ...none, query: "operation 9" }))).toEqual([
    3,
  ]);
  expect(
    ids(filterEvents(events, { ...none, query: "source_failed" })),
  ).toEqual([4]);
  expect(ids(filterEvents(events, { ...none, query: "nothing" }))).toEqual([]);
  expect(ids(filterEvents(events, { ...none, query: "   " }))).toEqual([
    1, 2, 3, 4,
  ]);
});

test("the filters narrow one another", () => {
  expect(
    ids(
      filterEvents(events, {
        route: "web",
        query: "failed",
        type: "route-failed",
      }),
    ),
  ).toEqual([4]);
  expect(
    ids(filterEvents(events, { route: "ota", query: "failed", type: null })),
  ).toEqual([]);
});
