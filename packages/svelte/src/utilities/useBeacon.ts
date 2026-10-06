import { BeaconError } from "@priemskiyyy/beacon";
import { getContext } from "svelte";
import { BEACON_CONTEXT } from "../context/BeaconContext.js";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredBeacon } from "../types/Register.js";

/**
 * Follows the nearest provider's Beacon through `current`, typed by the one
 * the application registered, and throws `INVALID_CONFIGURATION` when the
 * provider is missing. Reading it starts nothing.
 *
 * @example
 * ```ts
 * const beacon = useBeacon();
 *
 * const outcome = await beacon.current.route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): ReadableValue<RegisteredBeacon> => {
  const beacon = getContext<ReadableValue<RegisteredBeacon> | undefined>(
    BEACON_CONTEXT,
  );

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "useBeacon needs a BeaconProvider above it.",
    });
  }

  return beacon;
};
