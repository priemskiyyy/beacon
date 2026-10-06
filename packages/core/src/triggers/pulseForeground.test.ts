import { settle } from "src/mock/settle";
import { Pulse } from "@priemskiyyy/pulse";
import { createMockAdapter } from "@priemskiyyy/pulse/testing";
import { expect, test } from "vitest";

import { checkOn } from "src/triggers/checkOn";
import { createTestBeacon, deploy } from "src/triggers/checkOn.fixture";
import { fakePulse } from "src/triggers/fakeSources.fixture";
import { interval } from "src/triggers/interval";
import { pulseForeground } from "src/triggers/pulseForeground";

test("TRIG-27 a return after less than minAway is skipped, an unknown absence is not, and a long one checks", async () => {
  const { beacon, mock, clock } = createTestBeacon();
  const pulse = fakePulse();

  mock.answer({ document: deploy("update-2") });

  const stop = checkOn(beacon, {
    startup: false,
    triggers: [pulseForeground({ source: pulse.source, minAway: 30_000 })],
    minInterval: 1,
  });

  beacon.start();

  expect(pulse.listeners()).toBe(2);

  pulse.returnToApp(5_000);
  await settle();

  expect(mock.stats().reads).toBe(0);

  pulse.returnToApp(null);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1);
  pulse.returnToApp(30_000);
  await settle();

  expect(mock.stats().reads).toBe(2);

  stop();

  expect(pulse.listeners()).toBe(0);
});

test("TRIG-27 the interval pauses while the source says the app is away, and waits its full delay again after the return", async () => {
  const { beacon, mock, clock } = createTestBeacon();
  const pulse = fakePulse();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    startup: false,
    triggers: [
      pulseForeground({ source: pulse.source, minAway: 3_600_000 }),
      interval({ every: 60_000 }),
    ],
    minInterval: 1,
  });
  beacon.start();
  clock.advance(60_000);
  await settle();
  clock.advance(1);

  expect(mock.stats().reads).toBe(1);

  pulse.leave();

  expect(clock.pendingTimers()).toBe(0);

  clock.advance(10 * 60_000);
  await settle();

  expect(mock.stats().reads).toBe(1);

  pulse.returnToApp(10 * 60_000);
  clock.advance(59_999);
  await settle();

  expect(mock.stats().reads).toBe(1);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-27 the real Pulse over its own mock adapter says how long the app was away, and what it says decides the check", async () => {
  const { beacon, mock, clock } = createTestBeacon();

  const lifecycle = createMockAdapter({
    initial: { phase: "foreground", interaction: "available" },
  });

  const pulse = new Pulse({ adapter: lifecycle.adapter, now: clock.now });

  mock.answer({ document: deploy("update-2") });
  pulse.start();

  const stop = checkOn(beacon, {
    startup: false,
    triggers: [pulseForeground({ source: pulse, minAway: 30_000 })],
    minInterval: 1,
  });

  beacon.start();
  lifecycle.emit({ phase: "background", interaction: "unavailable" });
  clock.advance(5_000);
  lifecycle.emit({ phase: "foreground", interaction: "available" });
  await settle();

  expect(mock.stats().reads).toBe(0);

  lifecycle.emit({ phase: "background", interaction: "unavailable" });
  clock.advance(31_000);
  lifecycle.emit({ phase: "foreground", interaction: "available" });
  await settle();

  expect(mock.stats().reads).toBe(1);

  stop();
  clock.advance(1);
  lifecycle.emit({ phase: "background", interaction: "unavailable" });
  clock.advance(31_000);
  lifecycle.emit({ phase: "foreground", interaction: "available" });
  await settle();

  expect(mock.stats().reads).toBe(1);

  pulse.dispose();
});
