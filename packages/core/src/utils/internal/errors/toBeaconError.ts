import type { BeaconErrorCode } from "src/types/BeaconErrorCode";
import { BeaconError } from "src/utils/BeaconError";

type Fallback = { code: BeaconErrorCode; message: string };

/** Keeps a Beacon error as it is and wraps anything else, with the original as its cause. */
export const toBeaconError = (
  cause: unknown,
  { code, message }: Fallback,
): BeaconError => {
  if (cause instanceof BeaconError) {
    return cause;
  }

  return new BeaconError({ code, message, cause });
};
