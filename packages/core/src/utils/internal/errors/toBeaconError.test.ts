import { expect, test } from "vitest";

import type { BeaconErrorCode } from "src/types/BeaconErrorCode";
import { BeaconError } from "src/utils/BeaconError";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";

const FALLBACK: { code: BeaconErrorCode; message: string } = {
  code: "SOURCE_FAILED",
  message: "A release source could not be read.",
};

test("a Beacon error is kept as it is, whatever the fallback says", () => {
  const error = new BeaconError({ code: "SOURCE_TIMEOUT", message: "Late." });

  expect(toBeaconError(error, FALLBACK)).toBe(error);
});

test("anything else is wrapped with the fallback's code and message, and itself as the cause", () => {
  for (const cause of [
    new Error("The socket closed."),
    "a string",
    42,
    { status: 500 },
    null,
  ]) {
    const error = toBeaconError(cause, FALLBACK);

    expect(error).toBeInstanceOf(BeaconError);
    expect(error).toMatchObject(FALLBACK);
    expect(error.cause).toBe(cause);
  }
});

test("a failure that carries nothing is wrapped without a cause of its own", () => {
  const error = toBeaconError(undefined, FALLBACK);

  expect(error.code).toBe("SOURCE_FAILED");
  expect(Object.hasOwn(error, "cause")).toBe(false);
});
