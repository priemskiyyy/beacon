import { expect, test } from "vitest";

import { readField } from "src/utils/internal/journal/readField";

test("a key of the object itself is read", () => {
  expect(readField({ version: 1 }, "version")).toBe(1);
  expect(readField({ version: null }, "version")).toBeNull();
});

test("a key it has not, or only inherits, says nothing", () => {
  expect(readField({}, "version")).toBeUndefined();
  expect(readField(Object.create({ version: 1 }), "version")).toBeUndefined();
});

test("a value that is not an object has no keys, whatever its properties are", () => {
  expect(readField("web", "length")).toBeUndefined();
  expect(readField(7, "toFixed")).toBeUndefined();
  expect(readField(null, "version")).toBeUndefined();
  expect(readField(undefined, "version")).toBeUndefined();
});
