import { settle } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { checkOn } from "src/checkOn";
import { createTestBeacon, deploy } from "src/checkOn.fixture";
import { fakeChannel } from "src/fakeSources.fixture";
import { interval } from "src/interval";
import { invalidation } from "src/invalidation";
import { startup } from "src/startup";

test("TRIG-24 the interval checks every delay, arms one timer, and subscribes to nothing", async () => {
  const { beacon, mock, clock, reasons } = createTestBeacon();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, { triggers: [interval({ every: 60_000 })] });
  beacon.start();
  await settle();

  expect(clock.pendingTimers()).toBe(1);

  clock.advance(59_999);
  await settle();

  expect(mock.stats().reads).toBe(0);

  clock.advance(1);
  await settle();

  expect(reasons()).toEqual(["interval"]);

  clock.advance(60_000);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-24 the delay is measured from the last check that settled, whoever started it", async () => {
  const { beacon, mock, clock, reasons } = createTestBeacon();
  const channel = fakeChannel();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    triggers: [
      invalidation({ source: channel.source }),
      interval({ every: 60_000 }),
    ],
  });
  beacon.start();
  clock.advance(30_000);
  channel.push();
  await settle();

  expect(reasons()).toEqual(["invalidation"]);

  clock.advance(59_999);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1);
  await settle();

  expect(reasons()).toEqual(["invalidation", "interval"]);
});

test("TRIG-25 the jitter adds up to its share of the delay at random", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    triggers: [interval({ every: 60_000, jitter: 0.5 })],
    random: () => 0.5,
  });
  beacon.start();
  clock.advance(74_999);
  await settle();

  expect(mock.stats().reads).toBe(0);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-26 a tick the gate drops as fresh does not end the cadence", async () => {
  const { beacon, mock, clock, reasons } = createTestBeacon();

  mock.answer({
    document: deploy("update-2"),
    expiresAt: clock.now() + 590_000,
  });
  checkOn(beacon, {
    triggers: [startup(), interval({ every: 60_000 })],
    whileFresh: "skip",
  });
  beacon.start();
  await settle();
  clock.advance(589_999);
  await settle();

  expect(reasons()).toEqual(["startup"]);

  // The core flips the evidence to expired at 590,000, and the tick at 600,000 finds it so.
  clock.advance(10_001);
  await settle();

  expect(reasons()).toEqual(["startup", "interval"]);
});
