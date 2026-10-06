import { BeaconError } from "src/utils/BeaconError";

// A value of the wrong kind is described by its kind alone: it may be anything, and printing it could run its own code.
export const createVersionTypeError = (strategy: string, expected: string) =>
  new BeaconError({
    code: "INVALID_VERSION",
    message: `The ${strategy} strategy parses ${expected}.`,
  });
