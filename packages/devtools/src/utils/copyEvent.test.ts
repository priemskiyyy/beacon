import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { copyEvent } from "src/utils/copyEvent";

const event: BeaconDiagnosticEvent = {
  type: "route-failed",
  timestamp: 1_700_000_000_000,
  session: 2,
  route: "web",
  command: "reload",
  attempt: 3,
  operation: 7,
  reason: "SOURCE_FAILED",
};

test("an event is copied field by field, with its id and whether it is a failure", () => {
  expect(copyEvent(event, 12)).toEqual({ ...event, id: 12, failure: true });
  expect(copyEvent({ ...event, type: "session-started" }, 1).failure).toBe(
    false,
  );
});

test("the copy is a new object that shares nothing with the event", () => {
  const copy = copyEvent(event, 1);

  expect(copy).not.toBe(event);
  expect(Object.keys(copy).sort()).toEqual(
    [...Object.keys(event), "id", "failure"].sort(),
  );
});

test("what an event does not say stays null", () => {
  expect(
    copyEvent(
      {
        ...event,
        session: null,
        route: null,
        command: null,
        attempt: null,
        operation: null,
        reason: null,
      },
      1,
    ),
  ).toMatchObject({
    session: null,
    route: null,
    command: null,
    attempt: null,
    operation: null,
    reason: null,
  });
});

test("a time a clock got wrong is kept as it is for the panel to call invalid", () => {
  expect(copyEvent({ ...event, timestamp: Number.NaN }, 1).timestamp).toBeNaN();
  expect(
    copyEvent({ ...event, timestamp: Number.POSITIVE_INFINITY }, 1).timestamp,
  ).toBe(Number.POSITIVE_INFINITY);
});

test("a long text is cut to a limit and says so, and a field the event does not declare is never kept", () => {
  const long = "y".repeat(10_000);

  const copy = copyEvent(
    { ...event, reason: long, route: long, type: "route-failed" },
    1,
  );

  expect(copy.reason?.length).toBeLessThan(230);
  expect(copy.reason?.endsWith("… [Truncated]")).toBe(true);
  expect(copy.route?.length).toBeLessThan(230);

  const extra = { token: "leaked", context: { cookie: "leaked" } };
  const withExtra = copyEvent({ ...event, ...extra }, 1);

  expect(JSON.stringify(withExtra)).not.toContain("leaked");
  expect(long.length).toBe(10_000);
});
