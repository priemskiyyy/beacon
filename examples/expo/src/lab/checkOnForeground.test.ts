import { expect, test } from "vitest";

import { checkOnForeground } from "src/lab/checkOnForeground";

// The part of React Native's AppState the recipe uses, driven by hand.
const fakeAppState = (currentState: string | null = "active") => {
  const listeners = new Set<(state: string) => void>();

  return {
    currentState,
    addEventListener: (_type: "change", listener: (state: string) => void) => {
      listeners.add(listener);

      return { remove: () => listeners.delete(listener) };
    },
    emit: (state: string) => {
      for (const listener of [...listeners]) {
        listener(state);
      }
    },
    listeners: () => listeners.size,
  };
};

const fakeBeacon = () => {
  const reasons: Array<string | undefined> = [];

  return {
    reasons,
    check: async (options: { reason: "foreground" }) => {
      reasons.push(options.reason);
    },
  };
};

test("the app coming back from the background checks once, for the foreground", () => {
  const appState = fakeAppState();
  const beacon = fakeBeacon();

  checkOnForeground(beacon, appState);

  appState.emit("background");
  appState.emit("active");

  expect(beacon.reasons).toEqual(["foreground"]);
});

test("iOS passes through inactive on the way back, and that is still one check", () => {
  const appState = fakeAppState();
  const beacon = fakeBeacon();

  checkOnForeground(beacon, appState);

  appState.emit("background");
  appState.emit("inactive");
  appState.emit("active");

  expect(beacon.reasons).toEqual(["foreground"]);
});

test("the control center or a system dialog on iOS is inactive and back to active, and checks nothing", () => {
  const appState = fakeAppState();
  const beacon = fakeBeacon();

  checkOnForeground(beacon, appState);

  appState.emit("inactive");
  appState.emit("active");
  appState.emit("inactive");
  appState.emit("active");

  expect(beacon.reasons).toEqual([]);
});

test("every return from the background is its own check", () => {
  const appState = fakeAppState();
  const beacon = fakeBeacon();

  checkOnForeground(beacon, appState);

  for (const state of ["background", "active", "background", "active"]) {
    appState.emit(state);
  }

  expect(beacon.reasons).toEqual(["foreground", "foreground"]);
});

test("a dialog after the return checks nothing more, since the trip is over", () => {
  const appState = fakeAppState();
  const beacon = fakeBeacon();

  checkOnForeground(beacon, appState);

  for (const state of ["background", "active", "inactive", "active"]) {
    appState.emit(state);
  }

  expect(beacon.reasons).toEqual(["foreground"]);
});

test("an app that starts in the background checks when it first becomes active", () => {
  const appState = fakeAppState("background");
  const beacon = fakeBeacon();

  checkOnForeground(beacon, appState);

  appState.emit("active");

  expect(beacon.reasons).toEqual(["foreground"]);
});

test("the stop it answers removes the one listener it added, and no check comes after it", () => {
  const appState = fakeAppState();
  const beacon = fakeBeacon();

  const stop = checkOnForeground(beacon, appState);

  expect(appState.listeners()).toBe(1);

  stop();

  expect(appState.listeners()).toBe(0);

  appState.emit("background");
  appState.emit("active");

  expect(beacon.reasons).toEqual([]);
});
