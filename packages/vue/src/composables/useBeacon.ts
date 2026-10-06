import { BeaconError } from "@priemskiyyy/beacon";
import { inject } from "vue";
import type { ComputedRef } from "vue";

import { BEACON_CONTEXT } from "src/context/BeaconContext";
import type { RegisteredBeacon } from "src/types/Register";

/**
 * Returns the nearest provider's Beacon as a computed ref, typed by the one
 * the application registered, and throws when the provider is missing. The ref
 * follows a provider whose `beacon` prop changes. Reading it starts nothing.
 *
 * @example
 * ```ts
 * const beacon = useBeacon();
 *
 * const outcome = await beacon.value.route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): ComputedRef<RegisteredBeacon> => {
  const beacon = inject(BEACON_CONTEXT, undefined);

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "useBeacon needs a BeaconProvider above it.",
    });
  }

  return beacon;
};
