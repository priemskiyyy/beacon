import { settle } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { checkOn } from "src/checkOn";
import { createTestBeacon, deploy } from "src/checkOn.fixture";
import { fakeNetInfo } from "src/fakeSources.fixture";
import { reconnect } from "src/reconnect";

const create = (isConnected: boolean | null) => {
  const context = createTestBeacon();
  const network = fakeNetInfo(isConnected);

  context.mock.answer({ document: deploy("update-2") });

  checkOn(context.beacon, {
    startup: false,
    triggers: [reconnect({ netInfo: network.netInfo })],
    minInterval: 1,
  });
  context.beacon.start();

  return { ...context, network };
};

test("TRIG-23 a connected network at startup is not a reconnect, and staying connected is not one either", async () => {
  const { mock, network } = create(true);

  await settle();

  expect(network.listeners()).toBe(1);
  expect(mock.stats().reads).toBe(0);

  network.emit(true);
  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(0);
});

test("TRIG-23 a network that is lost and comes back checks once, for the reconnect", async () => {
  const { mock, network, reasons } = create(true);

  network.emit(false);
  await settle();

  expect(mock.stats().reads).toBe(0);

  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(1);
  expect(reasons()).toEqual(["reconnect"]);
});

test("TRIG-23 an app that started offline checks when the network first comes", async () => {
  const { mock, network } = create(false);

  await settle();

  expect(mock.stats().reads).toBe(0);

  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-23 a state NetInfo has not resolved is neither a loss nor a return", async () => {
  const { mock, network } = create(null);

  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(0);

  network.emit(false);
  network.emit(null);
  network.emit(true);
  await settle();

  expect(mock.stats().reads).toBe(0);
});
