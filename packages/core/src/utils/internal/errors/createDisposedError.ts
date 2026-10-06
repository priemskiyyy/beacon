import { BeaconError } from "src/utils/BeaconError";

export const createDisposedError = () =>
  new BeaconError({
    code: "DISPOSED",
    message: "This Beacon was disposed. Create a new one to observe again.",
  });
