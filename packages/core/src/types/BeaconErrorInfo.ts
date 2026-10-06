import type { BeaconErrorCode } from "src/types/BeaconErrorCode";

/**
 * What published state keeps of a failure: its code and message. The cause
 * stays on the thrown `BeaconError`, so a snapshot never holds a provider
 * payload, a URL or a credential.
 *
 * @example
 * ```ts
 * const failure: BeaconErrorInfo = { code: "DISPOSED", message: "Disposed." };
 * ```
 */
export type BeaconErrorInfo = {
  code: BeaconErrorCode;
  message: string;
};
