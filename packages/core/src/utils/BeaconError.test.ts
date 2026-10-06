import { expect, test } from "vitest";

import { BeaconError } from "src/utils/BeaconError";

test("a beacon error keeps its code, message and cause", () => {
  const cause = new Error("The provider threw.");

  const error = new BeaconError({
    code: "INVALID_CONFIGURATION",
    message: "The route is unknown.",
    cause,
  });

  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("BeaconError");
  expect(error.code).toBe("INVALID_CONFIGURATION");
  expect(error.message).toBe("The route is unknown.");
  expect(error.cause).toBe(cause);
});

test("a beacon error without a cause has no cause of its own", () => {
  const error = new BeaconError({ code: "DISPOSED", message: "Disposed." });

  expect(Object.hasOwn(error, "cause")).toBe(false);
});
