import { BeaconError } from "@priemskiyyy/beacon";
import { useContext } from "solid-js";
import type { Accessor } from "solid-js";

import { BeaconContext } from "src/context/BeaconContext";
import type { RegisteredBeacon } from "src/types/Register";

/**
 * Follows the nearest provider's Beacon as an accessor, typed by the one the
 * application registered, and throws when the provider is missing. Reading it
 * starts nothing.
 *
 * @example
 * ```ts
 * const beacon = useBeacon();
 * const outcome = await beacon().route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): Accessor<RegisteredBeacon> => {
  const beacon = useContext(BeaconContext);

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "useBeacon needs a BeaconProvider above it.",
    });
  }

  return beacon;
};
