import { BeaconError } from "@priemskiyyy/beacon";
import { inject } from "vue";
import type { ComputedRef } from "vue";

import { BEACON_CONTEXT } from "src/context/BeaconContext";
import type { RegisteredBeacon } from "src/types/Register";

// The composable that was called is named, since the one the developer wrote is rarely `useBeacon`.
export const useProvidedBeacon = (
  composable: string,
): ComputedRef<RegisteredBeacon> => {
  const beacon = inject(BEACON_CONTEXT, undefined);

  if (beacon === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `${composable} needs a BeaconProvider (from @priemskiyyy/beacon-vue) above it.`,
    });
  }

  return beacon;
};
