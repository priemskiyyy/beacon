import { settle } from "src/mock/settle";
import { expect, test } from "vitest";

import { checkOn } from "src/triggers/checkOn";
import { createTestBeacon, deploy } from "src/triggers/checkOn.fixture";
import { fakeAppState } from "src/triggers/fakeSources.fixture";
import { foreground } from "src/triggers/foreground";
import { interval } from "src/triggers/interval";

// A started Beacon that checks on the foreground of an app whose state a test drives.
const create = (currentState: string | null = "active", minAway?: number) => {
  const context = createTestBeacon();
  const app = fakeAppState(currentState);

  context.mock.answer({ document: deploy("update-2") });

  const stop = checkOn(context.beacon, {
    startup: false,
    triggers: [
      foreground({
        appState: app.appState,
        ...(minAway === undefined ? {} : { minAway }),
      }),
    ],
    minInterval: 1,
  });

  context.beacon.start();

  return { ...context, app, stop };
};

const emitAll = (app: ReturnType<typeof fakeAppState>, states: string[]) => {
  for (const state of states) {
    app.emit(state);
  }
};

test("TRIG-20 the app coming back from the background checks once, for the foreground", async () => {
  const { app, mock, reasons } = create();

  emitAll(app, ["background", "active"]);
  await settle();

  expect(mock.stats().reads).toBe(1);
  expect(reasons()).toEqual(["foreground"]);
});

test("TRIG-20 iOS passes through inactive on the way back, and that is still one check", async () => {
  const { app, mock } = create();

  emitAll(app, ["background", "inactive", "active"]);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-20 a system dialog on iOS is inactive and back to active, and checks nothing", async () => {
  const { app, mock } = create();

  emitAll(app, ["inactive", "active", "inactive", "active"]);
  await settle();

  expect(mock.stats().reads).toBe(0);
});

test("TRIG-20 every return from the background is its own check, and a dialog after the return is not one", async () => {
  const { app, mock, clock } = create();

  emitAll(app, ["background", "active"]);
  await settle();
  clock.advance(1);
  emitAll(app, ["background", "active"]);
  await settle();

  expect(mock.stats().reads).toBe(2);

  clock.advance(1);
  emitAll(app, ["inactive", "active"]);
  await settle();

  expect(mock.stats().reads).toBe(2);
});

test("TRIG-21 an app that starts in the background checks when it first becomes active", async () => {
  const { app, mock } = create("background");

  emitAll(app, ["active"]);
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("TRIG-21 an app whose state React Native has not resolved is not away until it says so", async () => {
  const { app, mock } = create(null);

  emitAll(app, ["inactive", "active"]);
  await settle();

  expect(mock.stats().reads).toBe(0);
});

test("TRIG-22 a return after less than minAway is skipped, measured from the first departure, and one whose departure was not seen never is", async () => {
  const { app, mock, clock } = create("active", 30_000);

  app.emit("background");
  clock.advance(5_000);
  app.emit("active");
  await settle();

  expect(mock.stats().reads).toBe(0);

  app.emit("background");
  clock.advance(20_000);
  // A second report of the same departure does not start the absence again.
  app.emit("background");
  clock.advance(15_000);
  app.emit("active");
  await settle();

  expect(mock.stats().reads).toBe(1);

  const unseen = create("background", 30_000);

  unseen.app.emit("active");
  await settle();

  expect(unseen.mock.stats().reads).toBe(1);
});

test("TRIG-22 a skipped return still ends the absence, so an interval waits its full delay again", async () => {
  const { beacon, mock, clock } = createTestBeacon();
  const app = fakeAppState();

  mock.answer({ document: deploy("update-2") });
  checkOn(beacon, {
    startup: false,
    triggers: [
      foreground({ appState: app.appState, minAway: 3_600_000 }),
      interval({ every: 60_000 }),
    ],
  });
  beacon.start();
  await settle();
  app.emit("background");

  expect(clock.pendingTimers()).toBe(0);

  clock.advance(10 * 60_000);
  app.emit("active");
  await settle();

  expect(mock.stats().reads).toBe(0);

  clock.advance(59_999);
  await settle();

  expect(mock.stats().reads).toBe(0);

  clock.advance(1);
  await settle();

  expect(mock.stats().reads).toBe(1);
});
