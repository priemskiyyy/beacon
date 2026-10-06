import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { BeaconClock } from "src/types/BeaconClock";
import { createBrokenClock } from "src/utils/Beacon.fixture";
import {
  createFeed,
  createFeedOn,
  createSession,
} from "src/utils/internal/feeds/FeedRecord.fixture";

test("CORE-02 an accepted document expires on its own and says so", async () => {
  const { feed, mock, clock, accepted } = createFeed();
  const session = createSession();
  const pending = feed.read(session, { mode: "join", signal: undefined });

  mock.resolve({ document: { name: "a" }, expiresAt: 1_600 });
  await pending;

  expect(feed.getAccepted()?.evidence.freshness).toBe("fresh");

  clock.advance(599);
  expect(feed.getAccepted()?.evidence.freshness).toBe("fresh");

  clock.advance(1);

  expect(feed.getAccepted()?.evidence).toMatchObject({
    freshness: "expired",
    expiresAt: 1_600,
  });
  expect(accepted.map((entry) => entry.evidence.freshness)).toEqual([
    "fresh",
    "expired",
  ]);
});

test("a document that arrives already expired is accepted as expired", async () => {
  const { feed, mock, clock } = createFeed();

  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  mock.resolve({ document: { name: "a" }, expiresAt: 900 });
  await pending;

  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
  expect(clock.pendingTimers()).toBe(0);
});

test("a document without an expiry never expires and arms no timer", async () => {
  const { feed, mock, clock } = createFeed();

  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  mock.resolve({ document: { name: "a" } });
  await pending;
  clock.advance(1_000_000);

  expect(feed.getAccepted()?.evidence).toMatchObject({
    freshness: "fresh",
    expiresAt: null,
  });
});

test("POL-04 a stopped session arms no expiry, and resuming expires what passed", async () => {
  const { feed, mock, clock } = createFeed();
  const first = createSession(1);
  const pending = feed.read(first, { mode: "join", signal: undefined });

  mock.resolve({ document: { name: "a" }, expiresAt: 2_000 });
  await pending;

  first.resources.dispose();
  expect(clock.pendingTimers()).toBe(0);

  clock.suspend(5_000);
  expect(feed.getAccepted()?.evidence.freshness).toBe("fresh");

  feed.resume(createSession(2));

  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
});

test("a resumed document that has not expired arms its expiry again", async () => {
  const { feed, mock, clock } = createFeed();
  const first = createSession(1);
  const pending = feed.read(first, { mode: "join", signal: undefined });

  mock.resolve({ document: { name: "a" }, expiresAt: 5_000 });
  await pending;
  first.resources.dispose();

  const second = createSession(2);

  feed.resume(second);
  expect(clock.pendingTimers()).toBe(1);

  clock.advance(4_000);
  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
});

test("a timer that wakes before the clock reaches the expiry waits for what remains", async () => {
  const { feed, mock, clock } = createFeed();

  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  mock.resolve({ document: { name: "a" }, expiresAt: 100_000 });
  await pending;

  // The wall clock went back while the timer counted on: the timer is early by what the wall clock lost.
  clock.setNow(0);
  clock.advance(99_000);

  expect(feed.getAccepted()?.evidence.freshness).toBe("fresh");
  expect(clock.pendingTimers()).toBe(1);

  clock.advance(1_000);

  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
  expect(clock.pendingTimers()).toBe(0);
});

test("a document that expires a millisecond after it was received is announced fresh before it is announced expired", async () => {
  const base = createTestClock({ now: 1_000 });

  // A host clock that has moved on by the time it is read again.
  const clock: BeaconClock = {
    ...base,
    now: () => {
      const time = base.now();

      base.suspend(1);

      return time;
    },
  };

  const { feed, mock, accepted } = createFeedOn(clock);

  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  mock.resolve({ document: { name: "a" }, expiresAt: 1_001 });
  await pending;
  base.advance(1);

  expect(accepted.map((entry) => entry.evidence.freshness)).toEqual([
    "fresh",
    "expired",
  ]);
  expect(feed.getAccepted()).toBe(accepted.at(-1));
});

test("a clock that refuses the timer of an expiry announces the document expired, since nobody would say when it stops holding", async () => {
  const { clock, state } = createBrokenClock();

  state.broken = false;

  const { feed, mock, accepted } = createFeedOn(clock);

  // The deadline of the read is armed, and the expiry that follows is refused.
  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  state.broken = true;
  mock.resolve({ document: { name: "a" }, expiresAt: 100_000 });
  await pending;

  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
  expect(accepted.map((entry) => entry.evidence.freshness)).toEqual([
    "expired",
  ]);
});

test("a clock that refuses the timer when a session resumes expires the document, and resuming does not throw", async () => {
  const { clock, state } = createBrokenClock();

  state.broken = false;

  const { feed, mock, accepted } = createFeedOn(clock);
  const first = createSession(1);
  const pending = feed.read(first, { mode: "join", signal: undefined });

  mock.resolve({ document: { name: "a" }, expiresAt: 100_000 });
  await pending;
  first.resources.dispose();
  state.broken = true;

  expect(() => feed.resume(createSession(2))).not.toThrow();
  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
  expect(accepted.map((entry) => entry.evidence.freshness)).toEqual([
    "fresh",
    "expired",
  ]);
});

test("a clock that refuses the timer of a wait that woke early expires the document, and the wake is no error of the host's timer", async () => {
  const { clock, state } = createBrokenClock();

  state.broken = false;

  const { feed, mock } = createFeedOn(clock);

  const pending = feed.read(createSession(), {
    mode: "join",
    signal: undefined,
  });

  mock.resolve({ document: { name: "a" }, expiresAt: 100_000 });
  await pending;

  // The wall clock went back while the timer counted on, so the timer wakes early and must wait again.
  clock.setNow(0);
  state.broken = true;

  expect(() => clock.advance(99_000)).not.toThrow();
  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
});
