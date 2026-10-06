import { useEffect } from "react";

import { BeaconContext } from "src/context/BeaconContext";
import type { BeaconProviderProps } from "src/types/BeaconProviderProps";

/**
 * Publishes one Beacon to the tree below. With `start`, it holds the
 * observation session while mounted and ends only that session on unmount;
 * it never disposes the Beacon, and it checks nothing.
 *
 * @example
 * ```tsx
 * <BeaconProvider beacon={beacon} start>
 *   <Application />
 * </BeaconProvider>
 * ```
 */
export const BeaconProvider = ({
  beacon,
  start = false,
  children,
}: BeaconProviderProps) => {
  useEffect(() => {
    if (!start) {
      return;
    }

    return beacon.start();
  }, [beacon, start]);

  return (
    <BeaconContext.Provider value={beacon}>{children}</BeaconContext.Provider>
  );
};
