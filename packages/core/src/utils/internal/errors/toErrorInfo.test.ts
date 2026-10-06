import { expect, test } from "vitest";

import { BeaconError } from "src/utils/BeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";

test("SEC-05 published error info keeps the code and message and never the cause", () => {
  const info = toErrorInfo(
    new BeaconError({
      code: "SOURCE_FAILED",
      message: "A release source could not be read.",
      cause: new Error("https://user:secret@example.com/manifest.json"),
    }),
  );

  expect(info).toEqual({
    code: "SOURCE_FAILED",
    message: "A release source could not be read.",
  });
  expect(Object.isFrozen(info)).toBe(true);
  expect(JSON.stringify(info)).not.toContain("secret");
});
