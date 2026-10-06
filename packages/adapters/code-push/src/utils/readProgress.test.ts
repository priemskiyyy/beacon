import { expect, test } from "vitest";

import type { DownloadProgressLike } from "src/types/DownloadProgressLike";
import { readProgress } from "src/utils/readProgress";

const progress = (
  receivedBytes: number,
  totalBytes: number,
): DownloadProgressLike => ({ receivedBytes, totalBytes });

test("readProgress is the fraction of the download that is done", () => {
  expect(readProgress(progress(1_024, 4_096))).toBe(0.25);
  expect(readProgress(progress(0, 4_096))).toBe(0);
  expect(readProgress(progress(4_096, 4_096))).toBe(1);
});

test("readProgress is null when CodePush gave no total, and never a made-up one", () => {
  expect(readProgress(progress(1_024, 0))).toBeNull();
  expect(readProgress(progress(1_024, -4_096))).toBeNull();
});

test("readProgress is null for a count that is negative, or that says more arrived than was expected", () => {
  expect(readProgress(progress(-5, 4_096))).toBeNull();
  expect(readProgress(progress(9_000, 4_096))).toBeNull();
});

test("readProgress is null for a count that is no number, whatever the native side hands over", () => {
  // What an event can carry, though its type says otherwise.
  const missing: DownloadProgressLike = JSON.parse('{"totalBytes":4096}');

  const text: DownloadProgressLike = JSON.parse(
    '{"receivedBytes":"lots","totalBytes":4096}',
  );

  expect(readProgress(progress(Number.NaN, 4_096))).toBeNull();
  expect(readProgress(progress(1_024, Number.NaN))).toBeNull();
  expect(readProgress(progress(Infinity, Infinity))).toBeNull();
  expect(readProgress(missing)).toBeNull();
  expect(readProgress(text)).toBeNull();
});
