import { expect, test } from "vitest";

import { readParameters } from "src/utils/internal/commands/readParameters";

test("readParameters leaves out the keys Beacon reads itself", () => {
  const controller = new AbortController();
  const call = { signal: controller.signal, flow: "flexible" };

  expect(readParameters(call)).toEqual({ flow: "flexible" });
});

test("readParameters answers nothing for a call that brings only references", () => {
  expect(readParameters({})).toEqual({});
});

test("readParameters keeps a key that names a prototype as a plain key, and changes no prototype", () => {
  const call = JSON.parse('{"__proto__":{"polluted":true},"flow":"flexible"}');
  const parameters = readParameters(call);

  expect(Object.keys(parameters)).toEqual(["__proto__", "flow"]);
  expect(Object.getPrototypeOf(parameters)).toBe(Object.prototype);
  expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined();
});
