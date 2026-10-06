import { expect, test } from "vitest";

import { readLabel } from "src/utils/readLabel";

test("a label is kept as the server gave it", () => {
  expect(readLabel("v12")).toBe("v12");
});

test("a label that is empty, blank or missing is no label", () => {
  const omitted: { label: string } = JSON.parse("{}");

  for (const label of ["", " ", omitted.label]) {
    expect(readLabel(label)).toBeNull();
  }
});
