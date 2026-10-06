import { expect, test } from "vitest";

import { createReleaseSource } from "src/utils/createReleaseSource";
import {
  createFeed,
  createFeedWithStartHook,
  createSession,
} from "src/utils/internal/feeds/FeedRecord.fixture";
import type { Manifest } from "src/utils/internal/feeds/FeedRecord.fixture";
import { settle } from "src/utils/Beacon.fixture";

test("HTTP-01 callers of one source share a single read and its attempt", async () => {
  const { feed, mock, accepted } = createFeed();
  const session = createSession();

  const first = feed.read(session, { mode: "join", signal: undefined });
  const second = feed.read(session, { mode: "join", signal: undefined });

  mock.resolve({ document: { name: "a" } });

  await expect(first).resolves.toEqual({ status: "accepted", attempt: 1 });
  await expect(second).resolves.toEqual({ status: "accepted", attempt: 1 });
  expect(mock.stats().reads).toBe(1);
  expect(accepted).toHaveLength(1);
  expect(feed.getAccepted()?.document).toEqual({ name: "a" });
});

test("HTTP-03 one joined caller that aborts ends only its own wait", async () => {
  const { feed, mock } = createFeed();
  const session = createSession();
  const controller = new AbortController();

  const leaving = feed.read(session, {
    mode: "join",
    signal: controller.signal,
  });

  const staying = feed.read(session, { mode: "join", signal: undefined });

  controller.abort();

  await expect(leaving).resolves.toEqual({ status: "cancelled" });
  expect(mock.contexts()[0]?.signal.aborted).toBe(false);

  mock.resolve({ document: { name: "a" } });

  await expect(staying).resolves.toEqual({ status: "accepted", attempt: 1 });
});

test("HTTP-04 a read nobody waits for anymore is aborted and its answer is ignored", async () => {
  const { feed, mock, accepted, failures, records } = createFeed();
  const session = createSession();
  const controller = new AbortController();

  const only = feed.read(session, { mode: "join", signal: controller.signal });

  controller.abort();
  await only;

  expect(mock.contexts()[0]?.signal.aborted).toBe(true);
  expect(failures.map((error) => error.code)).toEqual(["ABORTED"]);

  mock.resolve({ document: { name: "late" } });
  await settle();

  expect(accepted).toEqual([]);
  expect(feed.getAccepted()).toBeNull();
  expect(records).toContain("late-callback");
});

test("HTTP-05 two after-current callers during a read share one trailing read", async () => {
  const { feed, mock } = createFeed();
  const session = createSession();

  const current = feed.read(session, { mode: "join", signal: undefined });

  const firstTrailing = feed.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  const secondTrailing = feed.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  expect(mock.stats().reads).toBe(1);

  mock.resolve({ document: { name: "a" } });
  await current;

  expect(mock.stats().reads).toBe(2);

  mock.resolve({ document: { name: "b" } });

  await expect(firstTrailing).resolves.toEqual({
    status: "accepted",
    attempt: 2,
  });
  await expect(secondTrailing).resolves.toEqual({
    status: "accepted",
    attempt: 2,
  });
  expect(mock.stats().reads).toBe(2);
});

test("CORE-02 a failed read keeps the accepted document and reports the failure", async () => {
  const { feed, mock, failures } = createFeed();
  const session = createSession();

  const first = feed.read(session, { mode: "join", signal: undefined });

  mock.resolve({ document: { name: "a" } });
  await first;

  const second = feed.read(session, { mode: "join", signal: undefined });

  mock.reject(new Error("offline"));

  await expect(second).resolves.toMatchObject({
    status: "failed",
    attempt: 2,
    error: { code: "SOURCE_FAILED" },
  });
  expect(feed.getAccepted()?.document).toEqual({ name: "a" });
  expect(failures.map((error) => error.code)).toEqual(["SOURCE_FAILED"]);
});

test("a source that throws synchronously is a failed read, not a rejection", async () => {
  const { feed } = createFeed({
    source: createReleaseSource<Manifest>({
      name: "throwing",
      read: () => {
        throw new Error("The client is not configured.");
      },
    }),
  });

  await expect(
    feed.read(createSession(), { mode: "join", signal: undefined }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
});

test("a read that outlives its deadline fails with a timeout and is aborted", async () => {
  const { feed, mock, clock } = createFeed({ timeout: 500 });

  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  clock.advance(500);

  await expect(pending).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_TIMEOUT" },
  });
  expect(mock.contexts()[0]?.signal.aborted).toBe(true);

  mock.resolve({ document: { name: "late" } });
  await settle();

  expect(feed.getAccepted()).toBeNull();
});

test("LIFE-01 a session that ends during a read supersedes its waiters and drops the late answer", async () => {
  const { feed, mock, records } = createFeed();
  const session = createSession();

  const waiting = feed.read(session, { mode: "join", signal: undefined });

  const trailing = feed.read(session, {
    mode: "after-current",
    signal: undefined,
  });

  session.scope.dispose();

  await expect(waiting).resolves.toEqual({ status: "superseded" });
  await expect(trailing).resolves.toEqual({ status: "superseded" });
  expect(mock.contexts()[0]?.signal.aborted).toBe(true);

  mock.resolve({ document: { name: "late" } });
  await settle();

  expect(feed.getAccepted()).toBeNull();
  expect(records).toContain("late-callback");
});

test("a read asked of a session that already ended is superseded without reading", async () => {
  const { feed, mock } = createFeed();
  const session = createSession();

  session.scope.dispose();

  await expect(
    feed.read(session, { mode: "join", signal: undefined }),
  ).resolves.toEqual({ status: "superseded" });
  expect(mock.stats().reads).toBe(0);
});

test("a caller whose signal already aborted never starts a read", async () => {
  const { feed, mock } = createFeed();
  const controller = new AbortController();

  controller.abort();

  await expect(
    feed.read(createSession(), { mode: "join", signal: controller.signal }),
  ).resolves.toEqual({ status: "cancelled" });
  expect(mock.stats().reads).toBe(0);
});

test("a listener that ends the session when a read starts supersedes the caller", async () => {
  const { feed, mock } = createFeed();
  const session = createSession();

  const started = createFeedWithStartHook(() => session.scope.dispose());

  await expect(
    started.feed.read(session, { mode: "join", signal: undefined }),
  ).resolves.toEqual({ status: "superseded" });
  expect(started.mock.stats().reads).toBe(0);
  expect(mock.stats().reads).toBe(0);
  expect(feed.getAccepted()).toBeNull();
});
