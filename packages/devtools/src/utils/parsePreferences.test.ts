import { expect, test } from "vitest";

import { parsePreferences } from "src/utils/parsePreferences";

test("a well spelled value is kept whole", () => {
  expect(
    parsePreferences({
      isOpen: true,
      position: "right",
      height: 300,
      width: 640,
    }),
  ).toEqual({ isOpen: true, position: "right", height: 300, width: 640 });
  expect(parsePreferences({ isOpen: false, position: "bottom" })).toEqual({
    isOpen: false,
    position: "bottom",
  });
});

test("anything that is not an object is forgotten", () => {
  for (const raw of [null, undefined, 1, "open", true, [1, 2]]) {
    expect(parsePreferences(raw)).toEqual({});
  }
});

test("each field is kept or forgotten on its own", () => {
  expect(
    parsePreferences({
      isOpen: "yes",
      position: "top",
      height: -5,
      width: 1.5,
    }),
  ).toEqual({});
  expect(
    parsePreferences({ isOpen: true, position: "top", height: 0 }),
  ).toEqual({
    isOpen: true,
  });
  expect(
    parsePreferences({ height: Number.NaN, width: Number.POSITIVE_INFINITY }),
  ).toEqual({});
  expect(parsePreferences({ height: "300", width: 300, extra: 1 })).toEqual({
    width: 300,
  });
});
