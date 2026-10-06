import { expect, test } from "vitest";

import { measureBytes } from "src/utils/measureBytes";

test.each([
  ["", 0],
  ["abc", 3],
  ["é", 2],
  ["€", 3],
  ["😀", 4],
  ["a€😀", 8],
])("%j is %i bytes of UTF-8", (text, bytes) => {
  expect(measureBytes(text)).toBe(bytes);
  expect(new TextEncoder().encode(text).byteLength).toBe(bytes);
});
