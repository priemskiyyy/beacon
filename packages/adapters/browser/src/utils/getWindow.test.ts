import { expect, onTestFinished, test, vi } from "vitest";

import { fakeWindow } from "src/fakeWindow.fixture";
import { getWindow } from "src/utils/getWindow";

test("getWindow prefers the window it was given", () => {
  const target = fakeWindow();

  expect(getWindow(target)).toBe(target);
});

test("getWindow falls back to the global window", () => {
  const target = fakeWindow();

  vi.stubGlobal("window", target);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  expect(getWindow(undefined)).toBe(target);
});

test("getWindow has no window in a server render", () => {
  expect(getWindow(undefined)).toBeNull();
});
