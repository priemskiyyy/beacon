import { expect, test } from "vitest";

import { isSameData } from "src/utils/internal/common/isSameData";

test("equal primitives, arrays and nested objects are the same data", () => {
  expect(isSameData(1, 1)).toBe(true);
  expect(isSameData("a", "a")).toBe(true);
  expect(isSameData(null, null)).toBe(true);
  expect(isSameData([1, [2, { a: 3 }]], [1, [2, { a: 3 }]])).toBe(true);
  expect(isSameData({ a: 1, b: { c: [1] } }, { b: { c: [1] }, a: 1 })).toBe(
    true,
  );
});

test("a different value, length, key or shape is different data", () => {
  expect(isSameData(1, 2)).toBe(false);
  expect(isSameData("1", 1)).toBe(false);
  expect(isSameData([1], [1, 2])).toBe(false);
  expect(isSameData({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  expect(isSameData({ a: 1 }, { b: 1 })).toBe(false);
  expect(isSameData({ a: undefined }, { b: undefined })).toBe(false);
  expect(isSameData([], {})).toBe(false);
  expect(isSameData(null, {})).toBe(false);
  expect(isSameData({}, null)).toBe(false);
});

test("a hole in an array is a value that is missing, not one to skip", () => {
  const holey: Array<number | undefined> = [];

  holey.length = 2;
  holey[1] = 1;

  expect(isSameData(holey, [2, 1])).toBe(false);
  expect(isSameData([2, 1], holey)).toBe(false);
  expect(isSameData(holey, [undefined, 1])).toBe(true);
});

test("a key named like a prototype is data like any other", () => {
  const left: unknown = JSON.parse('{"__proto__": {"polluted": 1}, "a": 1}');
  const right: unknown = JSON.parse('{"a": 1, "__proto__": {"polluted": 2}}');

  expect(isSameData(left, left)).toBe(true);
  expect(isSameData(left, right)).toBe(false);
  expect(Reflect.get({}, "polluted")).toBeUndefined();
});

test("an instance that is not plain data is the same only as itself", () => {
  const date = new Date(1);

  expect(isSameData(date, date)).toBe(true);
  expect(isSameData(new Date(1), new Date(1))).toBe(false);
  expect(isSameData(new Map(), new Map())).toBe(false);
});
