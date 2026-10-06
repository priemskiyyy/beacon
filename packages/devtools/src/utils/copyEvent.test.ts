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
  cause: null,
};

test("an event is copied field by field, with its id and whether it is a failure", () => {
  expect(copyEvent(event, 12)).toEqual({ ...event, id: 12, failure: true });
  expect(copyEvent({ ...event, type: "session-started" }, 1).failure).toBe(
    false,
  );
});

test("what a failure threw is kept as bounded text that names its class, message and own fields, and a secret-named field is replaced", () => {
  class ProviderError extends Error {
    code = "E_UPDATES_DISABLED";

    token = "leaked-token";
  }

  const failure = new ProviderError("The provider refused.", {
    cause: new TypeError("inner failure", { cause: "a plain reason" }),
  });

  const { cause } = copyEvent({ ...event, cause: failure }, 1);

  expect(cause).toContain("[ProviderError]");
  expect(cause).toContain("The provider refused.");
  expect(cause).toContain("E_UPDATES_DISABLED");
  expect(cause).toContain("[TypeError]");
  expect(cause).toContain("inner failure");
  expect(cause).toContain("a plain reason");
  expect(cause).toContain("[Redacted]");
  expect(cause).not.toContain("leaked-token");
});

test("a cause that is no error is inspected like any value, and one that is a hostile object runs nothing", () => {
  const ran: string[] = [];

  const hostile = {
    get message() {
      ran.push("message");

      return "from a getter";
    },
    toJSON() {
      ran.push("toJSON");

      return "from toJSON";
    },
    password: "leaked-password",
  };

  const error = new Error("boom");

  Object.defineProperty(error, "name", {
    get() {
      ran.push("name");

      return "Getter";
    },
  });

  expect(copyEvent({ ...event, cause: "a rejection" }, 1).cause).toContain(
    "a rejection",
  );

  const plain = copyEvent({ ...event, cause: hostile }, 1).cause;
  const named = copyEvent({ ...event, cause: error }, 1).cause;

  expect(ran).toEqual([]);
  expect(plain).not.toContain("leaked-password");
  expect(named).toContain("boom");
});

test("a cause is cut to a limit, however long its message and however deep its chain", () => {
  let chain = new Error("the last");

  for (let depth = 0; depth < 50; depth += 1) {
    chain = new Error("x".repeat(5_000), { cause: chain });
  }

  const { cause } = copyEvent({ ...event, cause: chain }, 1);

  expect(cause?.length).toBeLessThan(12_100);
  expect(cause).toContain("[Truncated]");
});

test("an error that is its own cause ends the chain instead of looping", () => {
  const looping = new Error("round and round");

  Object.defineProperty(looping, "cause", { value: looping });

  const { cause } = copyEvent({ ...event, cause: looping }, 1);

  expect(cause).toContain("round and round");
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
        cause: null,
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
    cause: null,
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
