import { useLayoutEffect } from "react";

import { BeaconContext } from "src/context/BeaconContext";
import type { BeaconProviderProps } from "src/types/BeaconProviderProps";

/**
 * Publishes one Beacon to the tree below and holds its observation session
 * while mounted: it starts the session before any child's `useEffect` runs and
 * ends only that session on unmount. `start={false}` leaves the session to the
 * application. It never disposes the Beacon, and it checks nothing. A child's
 * `useLayoutEffect` runs before its parent's, so it finds the session not
 * started yet.
 *
 * @example
 * ```tsx
 * <BeaconProvider beacon={beacon}>
 *   <Application />
 * </BeaconProvider>
 * ```
 */
export const BeaconProvider = ({
  beacon,
  start = true,
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
