import { settle } from "src/mock/settle";
import { afterEach, expect, test, vi } from "vitest";

import { fakePage } from "src/triggers/browser/fakePage.fixture";
import { reconnect } from "src/triggers/browser/reconnect";
import { checkOn } from "src/triggers/checkOn";
import { createTestBeacon, deploy } from "src/triggers/checkOn.fixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

const create = () => {
  const context = createTestBeacon();
  const page = fakePage();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [reconnect({ target: page.target })],
    minInterval: 1,
  });

  context.beacon.start();

  return { ...context, page, stop };
};

test("TRIG-23 a page that is online at startup is not a reconnect, and the online event is", async () => {
  const { page, mock, reasons } = create();

  await settle();
  expect(mock.stats().reads).toBe(0);

  page.comeOnline();
  await settle();

  expect(mock.stats().reads).toBe(1);
  expect(reasons()).toEqual(["reconnect"]);
});

test("TRIG-01 it listens for online only while a session is open, with one listener that stopping takes back", async () => {
  const context = createTestBeacon();
  const page = fakePage();

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [reconnect({ target: page.target })],
  });

  expect(page.listeners().online).toBe(0);

  context.beacon.start();
  await settle();
  expect(page.listeners()).toEqual({ visibility: 0, pageshow: 0, online: 1 });

  context.beacon.stop();
  expect(page.listeners().online).toBe(0);

  context.beacon.start();
  stop();
  expect(page.listeners().online).toBe(0);
});

test("TRIG-23 a reconnect does not wait out the backoff of a failure, and its read begins after the one that met the dead network", async () => {
  const context = createTestBeacon();
  const page = fakePage();

  checkOn(context.beacon, {
    startup: false,
    triggers: [reconnect({ target: page.target })],
    backoff: { first: 60_000, max: 60_000, jitter: 0, attempts: 0 },
    minInterval: 1,
  });
  context.beacon.start();

  page.comeOnline();
  await settle();
  context.mock.reject(new Error("offline"));
  await settle();

  context.clock.advance(10);
  page.comeOnline();
  await settle();

  expect(context.mock.stats().reads).toBe(2);
});

test("a page with no window, as in a server render, installs nothing", async () => {
  const context = createTestBeacon();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [reconnect()],
  });

  context.beacon.start();
  await settle();

  expect(context.mock.stats().reads).toBe(0);
  expect(() => stop()).not.toThrow();
});

// In React Native `window` is the global object, which has no document and no addEventListener: what is there is not a browser's.
test("a runtime whose window is not a browser's, as React Native's global is, installs nothing and throws nothing", async () => {
  vi.stubGlobal("window", {});

  const context = createTestBeacon();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [reconnect()],
  });

  expect(() => context.beacon.start()).not.toThrow();
  await settle();

  expect(context.mock.stats().reads).toBe(0);
  expect(() => stop()).not.toThrow();
});

test("without a target it listens to the global window, reached when a session opens", async () => {
  const page = fakePage();

  vi.stubGlobal("window", undefined);

  const trigger = reconnect();
  const context = createTestBeacon();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, { startup: false, triggers: [trigger] });

  vi.stubGlobal("window", page.target);
  context.beacon.start();
  await settle();

  page.comeOnline();
  await settle();

  expect(context.reasons()).toEqual(["reconnect"]);
  stop();
  expect(page.listeners().online).toBe(0);
});
