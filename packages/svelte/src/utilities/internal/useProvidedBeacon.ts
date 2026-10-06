import { BeaconError } from "@priemskiyyy/beacon";
import { getContext } from "svelte";
import { BEACON_CONTEXT } from "../../context/BeaconContext.js";
import type { ReadableValue } from "../../types/ReadableValue.js";
import type { RegisteredBeacon } from "../../types/Register.js";

// The utility that was called is named, since the one the developer wrote is rarely `useBeacon`.
export const useProvidedBeacon = (
  utility: string,
): ReadableValue<RegisteredBeacon> => {
  const beacon = getContext<ReadableValue<RegisteredBeacon> | undefined>(
    BEACON_CONTEXT,
  );

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `${utility} needs a BeaconProvider (from @priemskiyyy/beacon-svelte) above it.`,
    });
  }

  return beacon;
};
