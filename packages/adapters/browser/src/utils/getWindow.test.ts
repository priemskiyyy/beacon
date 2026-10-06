import { expect, onTestFinished, test, vi } from "vitest";

import { fakeWindow } from "src/fakeWindow.fixture";
import { getWindow } from "src/utils/getWindow";

test("getWindow is the global window", () => {
  const target = fakeWindow();

  vi.stubGlobal("window", target);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  expect(getWindow()).toBe(target);
});

test("getWindow has no window in a server render", () => {
  expect(getWindow()).toBeNull();
});
