import { expect, test } from "vitest";

import { cleanText } from "src/utils/cleanText";

test("text is trimmed, and nothing else about it is changed", () => {
  expect(cleanText(" 2.4.0 ")).toBe("2.4.0");
  expect(cleanText("1 2")).toBe("1 2");
  expect(cleanText("108")).toBe("108");
});

test("null, undefined, empty text and text of spaces are no value", () => {
  for (const value of [null, undefined, "", "   ", "\n\t"]) {
    expect(cleanText(value)).toBeNull();
  }
});

// A native module can answer what its types do not promise, such as a number where a build number is text, and nothing names a build by it.
test("an answer that is not text is no value", () => {
  for (const answer of [108, true, {}, []]) {
    expect(Reflect.apply(cleanText, undefined, [answer])).toBeNull();
  }
});
