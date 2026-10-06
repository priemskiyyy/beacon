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
