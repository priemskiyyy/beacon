import { settle } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { checkOn } from "src/checkOn";
import { createTestBeacon, deploy } from "src/checkOn.fixture";
import { fakeCondition } from "src/fakeSources.fixture";
import { reachReconnect } from "src/reachReconnect";

const create = (status: "met" | "unmet" | "unknown") => {
  const context = createTestBeacon();
  const connected = fakeCondition(status);

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [reachReconnect({ condition: connected.condition })],
    minInterval: 1,
  });

  context.beacon.start();

  return { ...context, connected, stop };
};

test("TRIG-28 a condition that is met when it is subscribed to is not a reconnect, and a loss followed by a return is", async () => {
  const { mock, connected, stop, reasons } = create("met");

  await settle();

  expect(connected.listeners()).toBe(1);
  expect(mock.stats().reads).toBe(0);

  connected.set("unmet");
  await settle();

  expect(mock.stats().reads).toBe(0);

  connected.set("met");
  await settle();

  expect(reasons()).toEqual(["reconnect"]);

  stop();

  expect(connected.listeners()).toBe(0);
});

test("TRIG-28 a condition that was unmet when it was subscribed to is a reconnect when it is met", async () => {
  const { mock, connected } = create("unmet");

  connected.set("met");
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-28 an unknown condition is neither a loss nor a return", async () => {
  const { mock, connected } = create("unknown");

  connected.set("met");
  await settle();

  expect(mock.stats().reads).toBe(0);

  connected.set("unmet");
  connected.set("unknown");
  connected.set("met");
  await settle();

  expect(mock.stats().reads).toBe(0);
});
