import { BeaconError } from "@priemskiyyy/beacon";
import { useContext } from "react";

import { BeaconContext } from "src/context/BeaconContext";
import type { RegisteredBeacon } from "src/types/Register";

/**
 * Returns the nearest provider's Beacon, typed by the one the application
 * registered, and throws when the provider is missing. Reading it starts
 * nothing.
 *
 * @example
 * ```ts
 * const outcome = await useBeacon().route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): RegisteredBeacon => {
  const beacon = useContext(BeaconContext);

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "useBeacon needs a BeaconProvider above it.",
    });
  }

  return beacon;
};
