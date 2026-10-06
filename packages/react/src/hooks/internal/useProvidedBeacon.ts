import { BeaconError } from "@priemskiyyy/beacon";
import { useContext } from "react";

import { BeaconContext } from "src/context/BeaconContext";
import type { RegisteredBeacon } from "src/types/Register";

// The hook that was called is named, since the one the developer wrote is rarely `useBeacon`.
export const useProvidedBeacon = (hook: string): RegisteredBeacon => {
  const beacon = useContext(BeaconContext);

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `${hook} needs a BeaconProvider (from @priemskiyyy/beacon-react) above it.`,
    });
  }

  return beacon;
};
