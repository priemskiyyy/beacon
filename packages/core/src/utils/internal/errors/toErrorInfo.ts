import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { BeaconError } from "src/utils/BeaconError";

/** What published state keeps of a failure: the code and message, and never the cause. */
export const toErrorInfo = ({ code, message }: BeaconError): BeaconErrorInfo =>
  Object.freeze({ code, message });
