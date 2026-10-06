import { expect, test } from "vitest";

import { downloading } from "src/fakeBridge.fixture";
import { readProgress } from "src/utils/readProgress";

test("readProgress is the fraction of the download that is done", () => {
  expect(readProgress(downloading(1_024, 4_096))).toBe(0.25);
});

test("PLAY-10 readProgress is null when Play gave no total, and never a made-up one", () => {
  expect(readProgress(downloading(1_024, null))).toBeNull();
  expect(readProgress(downloading(null, 4_096))).toBeNull();
  expect(readProgress(downloading(1_024, 0))).toBeNull();
});

test("readProgress stays between zero and one whatever Play reports", () => {
  expect(readProgress(downloading(9_000, 4_096))).toBe(1);
  expect(readProgress(downloading(-5, 4_096))).toBe(0);
});
