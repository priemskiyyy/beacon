import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { SharedReadHooks } from "src/types/internal/SharedReadHooks";
import type { BeaconError } from "src/utils/BeaconError";
import { settle } from "src/utils/Beacon.fixture";
import { createSession } from "src/utils/internal/feeds/FeedRecord.fixture";
import { SharedRead } from "src/utils/internal/reads/SharedRead";

type HeldRead = {
  signal: AbortSignal;
  resolve: (answer: string) => void;
  reject: (error: Error) => void;
};

// A shared read whose every physical read is held until the test answers it.
const createHeld = (hooks: Partial<SharedReadHooks<string>> = {}) => {
  const failures: BeaconError[] = [];
  const records: string[] = [];
  const starts: number[] = [];
  const held: HeldRead[] = [];
  const clock = createTestClock({ now: 1_000 });

  const read = new SharedRead<string, string>({
    clock,
    timeout: 10_000,
    perform: ({ signal }) =>
      new Promise<string>((resolve, reject) => {
        held.push({ signal, resolve, reject });
      }),
    accept: (_attempt, answer) => answer,
    hooks: {
      started: (attempt) => starts.push(attempt),
      accepted: () => {},
      failed: (_attempt, error) => {
        failures.push(error);
      },
      record: (type) => records.push(type),
      ...hooks,
    },
    errors: {
      failed: { code: "SOURCE_FAILED", message: "The read failed." },
      invalid: { code: "INVALID_DOCUMENT", message: "The answer is invalid." },
      timeout: { code: "SOURCE_TIMEOUT", message: "The read timed out." },
    },
  });

  return { read, held, failures, records, starts, clock };
};

// Answers what a caller was told, or `hung` when it is still waiting after every queued continuation ran.
const settledOrHung = <TResult>(pending: Promise<TResult>) =>
  Promise.race([pending, settle().then((): "hung" => "hung")]);

const failing = () => {
  throw new Error("The owner could not take the failure.");
};

const create = (accepted: () => void) => {
  const failures: BeaconError[] = [];

  const read = new SharedRead<string, string>({
    clock: createTestClock({ now: 1_000 }),
    timeout: 10_000,
    perform: async () => "answer",
    accept: (_attempt, answer) => answer,
    hooks: {
      started: () => {},
      accepted,
      failed: (_attempt, error) => {
        failures.push(error);
      },
      record: () => {},
    },
    errors: {
      failed: { code: "SOURCE_FAILED", message: "The read failed." },
      invalid: { code: "INVALID_DOCUMENT", message: "The answer is invalid." },
      timeout: { code: "SOURCE_TIMEOUT", message: "The read timed out." },
    },
  });

  return { read, failures };
};

test("an accepted hook that throws fails the read instead of leaving its callers waiting", async () => {
  let throws = true;

  const { read, failures } = create(() => {
    if (!throws) {
      return;
    }

    throw new Error("The owner could not install the answer.");
  });

  const session = createSession();

  await expect(
    read.read(session, { mode: "join", signal: undefined }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "INVALID_DOCUMENT" },
  });
  expect(failures).toHaveLength(1);

  throws = false;

  await expect(
    read.read(session, { mode: "join", signal: undefined }),
  ).resolves.toMatchObject({ status: "accepted" });
});

test("HTTP-03 a trailing caller that leaves takes nothing from the read in flight, and starts no read of its own", async () => {
  const { read, held } = createHeld();
  const session = createSession();
  const controller = new AbortController();

  const current = read.read(session, { mode: "join", signal: undefined });

  const leaving = read.read(session, {
    mode: "after-current",
    signal: controller.signal,
  });

  controller.abort();

  await expect(leaving).resolves.toEqual({ status: "cancelled" });
  expect(held[0]?.signal.aborted).toBe(false);

  held[0]?.resolve("a");

  await expect(current).resolves.toEqual({ status: "accepted", attempt: 1 });
  expect(held).toHaveLength(1);
});

test("HTTP-03 a trailing caller is served by a read of its own when the caller before it leaves", async () => {
  const { read, held, records } = createHeld();
  const session = createSession();
  const controller = new AbortController();

  const leaving = read.read(session, {
    mode: "join",
    signal: controller.signal,
  });

  const trailing = read.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  controller.abort();

  await expect(leaving).resolves.toEqual({ status: "cancelled" });
  expect(held[0]?.signal.aborted).toBe(true);
  expect(held).toHaveLength(2);
  expect(records).toContain("read-abandoned");

  held[1]?.resolve("b");

  await expect(trailing).resolves.toEqual({ status: "accepted", attempt: 2 });
});

test("HTTP-05 a trailing caller that leaves while the answer is announced starts no read", async () => {
  const controller = new AbortController();

  const { read, held } = createHeld({
    accepted: () => controller.abort(),
  });

  const session = createSession();
  const current = read.read(session, { mode: "join", signal: undefined });

  const trailing = read.read(session, {
    mode: "after-current",
    signal: controller.signal,
  });

  held[0]?.resolve("a");

  await expect(current).resolves.toEqual({ status: "accepted", attempt: 1 });
  await expect(trailing).resolves.toEqual({ status: "cancelled" });
  expect(held).toHaveLength(1);
});

test("LIFE-01 a session that ends while the answer is announced supersedes the trailing caller and starts no read", async () => {
  const session = createSession();

  const { read, held, starts, failures } = createHeld({
    accepted: () => session.scope.dispose(),
  });

  const current = read.read(session, { mode: "join", signal: undefined });

  const trailing = read.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  held[0]?.resolve("a");

  await expect(current).resolves.toEqual({ status: "accepted", attempt: 1 });
  await expect(trailing).resolves.toEqual({ status: "superseded" });
  expect(held).toHaveLength(1);
  expect(starts).toEqual([1]);
  expect(failures).toEqual([]);
});

test("HTTP-04 a read that rejects because it was abandoned is a late callback and reports nothing more", async () => {
  const { read, held, failures, records } = createHeld();
  const controller = new AbortController();

  const only = read.read(createSession(), {
    mode: "join",
    signal: controller.signal,
  });

  controller.abort();
  await only;
  expect(failures.map((error) => error.code)).toEqual(["ABORTED"]);

  held[0]?.reject(new Error("The read was aborted."));
  await settle();

  expect(failures.map((error) => error.code)).toEqual(["ABORTED"]);
  expect(records).toContain("late-callback");
});

test("LIFE-01 a read that another cleanup of the same session already finished is not ended twice", async () => {
  const session = createSession();
  const controller = new AbortController();
  const first = createHeld();

  const second = createHeld({
    failed: () => controller.abort(),
  });

  const waiting = first.read.read(session, {
    mode: "join",
    signal: controller.signal,
  });

  const other = second.read.read(session, {
    mode: "join",
    signal: undefined,
  });

  session.scope.dispose();

  await expect(waiting).resolves.toEqual({ status: "cancelled" });
  await expect(other).resolves.toEqual({ status: "superseded" });
  expect(first.failures.map((error) => error.code)).toEqual(["ABORTED"]);
});

test("LIFE-01 an owner that cannot take the end of a read still lets everyone who waited know", async () => {
  const session = createSession();
  const { read } = createHeld({ failed: failing });
  const waiting = read.read(session, { mode: "join", signal: undefined });

  const trailing = read.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  session.scope.dispose();

  await expect(settledOrHung(waiting)).resolves.toEqual({
    status: "superseded",
  });
  await expect(settledOrHung(trailing)).resolves.toEqual({
    status: "superseded",
  });
});

test("HTTP-05 an owner that cannot take a timeout still lets everyone who waited know, and the trailing read goes on", async () => {
  const session = createSession();
  const { read, held, clock } = createHeld({ failed: failing });
  const waiting = read.read(session, { mode: "join", signal: undefined });

  const trailing = read.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  expect(() => clock.advance(10_000)).toThrow("could not take the failure");
  await expect(settledOrHung(waiting)).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_TIMEOUT" },
  });
  expect(held).toHaveLength(2);

  session.scope.dispose();
  await expect(settledOrHung(trailing)).resolves.toEqual({
    status: "superseded",
  });
});

test("HTTP-05 what one call asks of an authority is one read, and another call's is a read after it", async () => {
  const { read, held } = createHeld();
  const session = createSession();
  const call: ReadOptions = { mode: "after-current", signal: undefined };

  const first = read.read(session, call);
  const second = read.read(session, call);

  expect(held).toHaveLength(1);

  const other = read.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  held[0]?.resolve("a");

  await expect(first).resolves.toEqual({ status: "accepted", attempt: 1 });
  await expect(second).resolves.toEqual({ status: "accepted", attempt: 1 });
  expect(held).toHaveLength(2);

  held[1]?.resolve("b");

  await expect(other).resolves.toEqual({ status: "accepted", attempt: 2 });

  const later = read.read(session, call);

  held[2]?.resolve("c");
  await expect(settledOrHung(later)).resolves.toEqual({
    status: "accepted",
    attempt: 3,
  });
});
