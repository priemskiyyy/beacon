import { settle } from "src/mock/settle";
import { afterEach, expect, test, vi } from "vitest";

import { foreground } from "src/triggers/browser/foreground";
import { fakePage } from "src/triggers/browser/fakePage.fixture";
import { checkOn } from "src/triggers/checkOn";
import { createTestBeacon, deploy } from "src/triggers/checkOn.fixture";
import { interval } from "src/triggers/interval";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A started Beacon that checks on the visibility of a page a test drives.
const create = (visibilityState = "visible", minAway?: number) => {
  const context = createTestBeacon();
  const page = fakePage(visibilityState);

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [
      foreground({
        target: page.target,
        ...(minAway === undefined ? {} : { minAway }),
      }),
    ],
    minInterval: 1,
  });

  context.beacon.start();

  return { ...context, page, stop };
};

test("TRIG-01 a page is listened to only once a session opens, by one listener of the document and one of the window, and stopping takes both back", async () => {
  const context = createTestBeacon();
  const page = fakePage();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [foreground({ target: page.target })],
  });

  await settle();
  expect(page.listeners()).toEqual({ visibility: 0, pageshow: 0, online: 0 });

  context.beacon.start();
  await settle();
  expect(page.listeners()).toEqual({ visibility: 1, pageshow: 1, online: 0 });

  stop();
  expect(page.listeners()).toEqual({ visibility: 0, pageshow: 0, online: 0 });
});

test("TRIG-20 a tab that is hidden and shown again checks once, for the foreground", async () => {
  const { page, mock, reasons } = create();

  page.hide();
  page.show();
  await settle();

  expect(mock.stats().reads).toBe(1);
  expect(reasons()).toEqual(["foreground"]);
});

test("TRIG-20 a page that is shown while it was never hidden checks nothing", async () => {
  const { page, mock } = create();

  page.show();
  page.show();
  await settle();

  expect(mock.stats().reads).toBe(0);
});

test("TRIG-20 a page that starts hidden checks when it is first shown", async () => {
  const { page, mock } = create("hidden");

  await settle();
  expect(mock.stats().reads).toBe(0);

  page.show();
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-20 a page the browser kept and shows again, from the back-forward cache, is a return, and a fresh load is not", async () => {
  const { page, mock, reasons } = create();

  page.restore(false);
  await settle();
  expect(mock.stats().reads).toBe(0);

  page.restore(true);
  await settle();

  expect(reasons()).toEqual(["foreground"]);
});

test("TRIG-20 a page restored after being shown by its visibility is one return, not two", async () => {
  const { page, mock, clock } = create();

  page.hide();
  clock.advance(10);
  page.show();
  page.restore(true);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-22 a return after less than minAway is skipped, an absence nobody saw begin never is, and a long one checks", async () => {
  const { page, mock, clock } = create("hidden", 30_000);

  page.show();
  await settle();
  expect(mock.stats().reads).toBe(1);

  clock.advance(10);
  page.hide();
  clock.advance(29_000);
  page.show();
  await settle();
  expect(mock.stats().reads).toBe(1);

  clock.advance(10);
  page.hide();
  clock.advance(30_000);
  page.show();
  await settle();
  expect(mock.stats().reads).toBe(2);
});

test("TRIG-22 a skipped return still ends the absence, so an interval waits its full delay again", async () => {
  const context = createTestBeacon();
  const page = fakePage();

  context.mock.answer({ document: deploy("update-2") });

  checkOn(context.beacon, {
    startup: false,
    triggers: [
      foreground({ target: page.target, minAway: 3_600_000 }),
      interval({ every: 60_000 }),
    ],
  });
  context.beacon.start();
  await settle();

  page.hide();
  expect(context.clock.pendingTimers()).toBe(0);

  context.clock.advance(10 * 60_000);
  page.show();
  await settle();

  expect(context.mock.stats().reads).toBe(0);

  context.clock.advance(59_999);
  await settle();
  expect(context.mock.stats().reads).toBe(0);

  context.clock.advance(1);
  await settle();

  expect(context.reasons()).toEqual(["interval"]);
});

test("a page with no window, as in a server render, installs nothing and costs nothing", async () => {
  const context = createTestBeacon();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [foreground()],
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
    triggers: [foreground()],
  });

  expect(() => context.beacon.start()).not.toThrow();
  await settle();

  expect(context.mock.stats().reads).toBe(0);
  expect(() => stop()).not.toThrow();
});

test("without a target it listens to the global window, reached when a session opens and not when the trigger is made", async () => {
  const page = fakePage();

  vi.stubGlobal("window", undefined);

  const trigger = foreground();
  const context = createTestBeacon();

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, { startup: false, triggers: [trigger] });

  vi.stubGlobal("window", page.target);
  context.beacon.start();
  await settle();

  expect(page.listeners()).toEqual({ visibility: 1, pageshow: 1, online: 0 });

  page.hide();
  page.show();
  await settle();

  expect(context.reasons()).toEqual(["foreground"]);
  stop();
  expect(page.listeners()).toEqual({ visibility: 0, pageshow: 0, online: 0 });
});
