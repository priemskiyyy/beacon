import { useLayoutEffect } from "react";

import { BeaconContext } from "src/context/BeaconContext";
import type { BeaconProviderProps } from "src/types/BeaconProviderProps";

/**
 * Publishes one Beacon to the tree below. With `start`, it holds the
 * observation session while mounted, before any child's effect runs, and ends
 * only that session on unmount; it never disposes the Beacon, and it checks
 * nothing.
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
  // A layout effect runs before every passive effect of the tree, so what a child does when it mounts finds the session started.
  useLayoutEffect(() => {
    if (!start) {
      return;
    }

    return beacon.start();
  }, [beacon, start]);

  return (
    <BeaconContext.Provider value={beacon}>{children}</BeaconContext.Provider>
  );
};
