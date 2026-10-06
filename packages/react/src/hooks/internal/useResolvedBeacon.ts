import { BeaconError } from "@priemskiyyy/beacon";
import { useContext } from "react";

import { BeaconContext } from "src/context/BeaconContext";
import type { ReactBeacon } from "src/types/ReactBeacon";

/** The Beacon a hook was given, else the provider's; a hook with neither is misused. */
export const useResolvedBeacon = (
  beacon: ReactBeacon | undefined,
  hook: string,
): ReactBeacon => {
  const provided = useContext(BeaconContext);
  const resolved = beacon ?? provided;

  if (resolved === undefined) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `${hook} needs a Beacon, passed in or from a BeaconProvider.`,
    });
  }

  return resolved;
};
