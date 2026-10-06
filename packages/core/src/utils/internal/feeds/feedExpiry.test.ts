import { expect, test } from "vitest";

import {
  createFeed,
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

  first.scope.dispose();
  expect(clock.pendingTimers()).toBe(0);

  clock.skip(5_000);
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
  first.scope.dispose();

  const second = createSession(2);

  feed.resume(second);
  expect(clock.pendingTimers()).toBe(1);

  clock.advance(4_000);
  expect(feed.getAccepted()?.evidence.freshness).toBe("expired");
});
