import { BeaconError } from "src/utils/BeaconError";

export const createInvalidVersionError = (strategy: string, input: string) =>
  new BeaconError({
    code: "INVALID_VERSION",
    message: `The value "${input}" is not a valid ${strategy} version.`,
  });
