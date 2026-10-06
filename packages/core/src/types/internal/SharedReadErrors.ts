import type { BeaconErrorCode } from "src/types/BeaconErrorCode";

/** The error a shared read raises for each way it can fail, in the vocabulary of its owner. */
export type SharedReadErrors = {
  failed: { code: BeaconErrorCode; message: string };
  invalid: { code: BeaconErrorCode; message: string };
  timeout: { code: BeaconErrorCode; message: string };
};
