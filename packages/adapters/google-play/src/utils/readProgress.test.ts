import { expect, test } from "vitest";

import { downloading } from "src/fakeBridge.fixture";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
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
  expect(readProgress(downloading(1_024, -4_096))).toBeNull();
});

test("PLAY-10 readProgress is null for a count that is no number, whatever the bridge hands over", () => {
  // What a native module can hand over, though its type says otherwise.
  const missing: PlayInstallEvent = JSON.parse(
    '{"status":"downloading","totalBytes":4096}',
  );

  const text: PlayInstallEvent = JSON.parse(
    '{"status":"downloading","bytesDownloaded":"lots","totalBytes":4096}',
  );

  expect(readProgress(downloading(Number.NaN, 4_096))).toBeNull();
  expect(readProgress(downloading(1_024, Number.NaN))).toBeNull();
  expect(readProgress(downloading(Infinity, Infinity))).toBeNull();
  expect(readProgress(missing)).toBeNull();
  expect(readProgress(text)).toBeNull();
});
