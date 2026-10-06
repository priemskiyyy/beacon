import { BeaconError } from "@priemskiyyy/beacon";
import { useContext } from "solid-js";
import type { Accessor } from "solid-js";

import { BeaconContext } from "src/context/BeaconContext";
import type { RegisteredBeacon } from "src/types/Register";

// The primitive that was called is named, since the one the developer wrote is rarely `useBeacon`.
export const useProvidedBeacon = (
  primitive: string,
): Accessor<RegisteredBeacon> => {
  const beacon = useContext(BeaconContext);

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `${primitive} needs a BeaconProvider (from @priemskiyyy/beacon-solid) above it.`,
    });
  }

  return beacon;
};
