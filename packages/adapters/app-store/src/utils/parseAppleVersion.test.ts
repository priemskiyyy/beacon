import { expect, test } from "vitest";

import { parseAppleVersion } from "src/utils/parseAppleVersion";

test("one to three numbers parse, the missing ones zero", () => {
  expect(parseAppleVersion("3")).toEqual([3, 0, 0]);
  expect(parseAppleVersion("3.2")).toEqual([3, 2, 0]);
  expect(parseAppleVersion("3.2.1")).toEqual([3, 2, 1]);
});

test("anything else breaks the grammar and is refused, not guessed", () => {
  for (const input of [
    "",
    "3.2.1.0",
    "3.x",
    "v3.2",
    "3.2-beta",
    "-1",
    "3..2",
    " 3.2",
  ]) {
    expect(() => parseAppleVersion(input)).toThrow(
      expect.objectContaining({ code: "INVALID_VERSION" }),
    );
  }
});

test("the message of a refusal names a long value by its beginning, since the value comes from a response and the message is published", () => {
  expect(() => parseAppleVersion("9".repeat(100_000))).toThrow(
    expect.objectContaining({
      code: "INVALID_VERSION",
      message: expect.stringMatching(/^.{0,120}$/),
    }),
  );
});
